/**
 * HIMSIntakeForm.jsx — HIMS Patient Intake Wizard v2.1
 * =====================================================
 * Changes from v2.0:
 *   - Idle timeout: 15-min inactivity auto-logout (useIdleTimeout)
 *   - Form persistence: sessionStorage draft save/restore (useFormPersistence)
 *     NO localStorage — tokens never written to persistent storage
 *   - beforeunload warning: browser confirms before tab close with unsaved data
 *   - Validation: discount clamped 0–100%, payment amounts must be >= 0
 *   - BTG: token is single-patient scoped, time-boxed (enforced by backend)
 *   - Fonts: self-hosted Inter (no Google Fonts CDN calls)
 */

import { useState, useEffect, useCallback } from "react";
import { authApi, patientsApi, lookupApi } from "./api/himsApi";
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import {
  saveFormDraft, loadFormDraft, clearFormDraft, useBeforeUnloadWarning,
} from "./hooks/useFormPersistence";
import LoginScreen     from "./components/LoginScreen";
import BTGModal        from "./components/BTGModal";
import StepNavigator   from "./components/StepNavigator";
import SuccessScreen   from "./components/SuccessScreen";
import IdleWarningBanner from "./components/IdleWarningBanner";

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Personal",    icon: "👤" },
  { id: 2, label: "Contact",     icon: "📞" },
  { id: 3, label: "Emergency",   icon: "🚨" },
  { id: 4, label: "Next of Kin", icon: "👨‍👩‍👧" },
  { id: 5, label: "Visit",       icon: "🏥" },
  { id: 6, label: "Insurance",   icon: "🛡️" },
  { id: 7, label: "Vitals",      icon: "💓" },
  { id: 8, label: "History",     icon: "📋" },
  { id: 9, label: "Admission",   icon: "🛏️" },
  { id: 10, label: "Financial",  icon: "💳" },
];

const CHRONIC_CONDITIONS = [
  "Diabetes (Type 1)", "Diabetes (Type 2)", "Hypertension",
  "Coronary Artery Disease", "Heart Failure", "Asthma", "COPD",
  "Chronic Kidney Disease", "Liver Disease", "Epilepsy / Seizures",
  "Thyroid Disorder", "Stroke / TIA", "Cancer", "HIV / AIDS",
  "Tuberculosis (TB)", "Mental Health Disorder",
];

const BLOOD_GROUPS  = ["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"];
const GENDERS       = ["Male","Female","Other","Prefer not to say"];
const PATIENT_TYPES = ["OPD","IPD","Emergency","Welfare"];
const PAYMENT_MODES = ["Cash","Corporate","Insurance","Welfare","Card","Bank Transfer"];
const REFERRAL_SRC  = ["Walk-in","Referred by Doctor","Emergency (Ambulance)","Self-referred","Corporate","Other"];
const VISIT_TYPES   = ["New Patient","Follow-up","Emergency"];

const EMPTY_FORM = {
  first_name:"", last_name:"", father_husband_name:"", date_of_birth:"",
  gender:"Male", blood_group:"Unknown", patient_type:"OPD", cnic:"",
  nationality:"Pakistani", marital_status:"", occupation:"",
  mobile_primary:"", mobile_secondary:"", email:"",
  address_line1:"", address_line2:"", city:"", province:"", postal_code:"",
  emergency_contact_name:"", emergency_contact_relation:"", emergency_contact_mobile:"",
  nok_name:"", nok_relation:"", nok_cnic:"", nok_mobile:"", nok_address:"",
  referral_source:"Walk-in", referring_doctor:"", visit_type:"New Patient",
  consultant_id:"", department_id:"",
  payment_category:"Self", corporate_company_id:"", insurance_company:"",
  policy_number:"", policy_validity:"", coverage_limit:"",
  temperature:"", pulse_rate:"", respiratory_rate:"",
  bp_systolic:"", bp_diastolic:"", spo2:"",
  weight_kg:"", height_cm:"", gcs_score:"", pain_score:"",
  known_allergies:"", current_medications:"", chronic_conditions:[],
  family_history:"", smoking_status:"Never", chief_complaint:"",
  ward_id:"", bed_id:"", admission_date:"", expected_discharge:"", advance_payment:"",
  payment_mode:"Cash", discount_pct:"0", is_welfare:false, welfare_notes:"",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcBMI(w, h) {
  const wv = parseFloat(w), hv = parseFloat(h);
  if (!wv || !hv || hv <= 0) return null;
  return (wv / Math.pow(hv / 100, 2)).toFixed(1);
}
function bmiCategory(bmi) {
  if (!bmi) return null;
  const v = parseFloat(bmi);
  if (v < 18.5) return { label:"Underweight", color:"#2196F3" };
  if (v < 25)   return { label:"Normal",      color:"#4CAF50" };
  if (v < 30)   return { label:"Overweight",  color:"#FF9800" };
  return              { label:"Obese",         color:"#F44336" };
}

// ── Field / Input / Select / Textarea / Row / SectionTitle ───────────────────
function Field({ label, required, error, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:5 }}>
        {label}{required && <span style={{ color:"#DC2626", marginLeft:2 }}>*</span>}
      </label>
      {children}
      {hint  && !error && <p style={{ fontSize:12, color:"#6B7280", marginTop:4 }}>{hint}</p>}
      {error && <p style={{ fontSize:12, color:"#DC2626", marginTop:4 }}>⚠ {error}</p>}
    </div>
  );
}
const inputStyle = (error) => ({
  width:"100%", boxSizing:"border-box", padding:"10px 12px",
  border:`1.5px solid ${error ? "#DC2626" : "#D1D5DB"}`,
  borderRadius:8, fontSize:14, color:"#111827", background:"#fff", outline:"none",
});
function Input({ error, ...props }) {
  return <input {...props} style={inputStyle(error)} />;
}
function Select({ error, children, ...props }) {
  return (
    <select {...props} style={{
      ...inputStyle(error), appearance:"none",
      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='https://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
      backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center",
    }}>
      {children}
    </select>
  );
}
function Textarea({ error, ...props }) {
  return <textarea {...props} rows={3} style={{ ...inputStyle(error), resize:"vertical", fontFamily:"inherit" }} />;
}
function Row({ children, cols=2 }) {
  return <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:"0 20px" }}>{children}</div>;
}
function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom:24 }}>
      <h2 style={{ fontSize:20, fontWeight:700, color:"#111827", margin:0, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:22 }}>{icon}</span> {title}
      </h2>
      {subtitle && <p style={{ fontSize:13, color:"#6B7280", marginTop:4, marginLeft:30 }}>{subtitle}</p>}
    </div>
  );
}
function VitalCard({ icon, label, value, unit, color="#1D4ED8" }) {
  const filled = value !== "" && value != null;
  return (
    <div style={{
      border:`2px solid ${filled ? color : "#E5E7EB"}`,
      borderRadius:10, padding:"12px 16px",
      background: filled ? `${color}08` : "#F9FAFB", transition:"all 0.2s",
    }}>
      <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:11, color:"#6B7280", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
      {filled
        ? <div style={{ fontSize:20, fontWeight:700, color }}>{value}<span style={{ fontSize:12, marginLeft:2 }}>{unit}</span></div>
        : <div style={{ fontSize:12, color:"#9CA3AF" }}>—</div>
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function HIMSIntakeForm() {
  const [auth, setAuth]           = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess]     = useState(null);
  const [btgOpen, setBtgOpen]     = useState(false);
  const [btgToken, setBtgToken]   = useState(null);
  const [isDirty, setIsDirty]     = useState(false);

  // Lookups
  const [consultants, setConsultants]         = useState([]);
  const [departments, setDepartments]         = useState([]);
  const [wards, setWards]                     = useState([]);
  const [beds, setBeds]                       = useState([]);
  const [corporateClients, setCorporateClients] = useState([]);

  const bmi    = calcBMI(form.weight_kg, form.height_cm);
  const bmiCat = bmiCategory(bmi);
  const isOPD  = form.patient_type === "OPD";
  const hasCorporate = ["Corporate","Insurance","Welfare"].includes(form.payment_category);

  // ── Idle timeout — auto-logout after 15 min inactivity ───────────────────
  const handleIdleLogout = useCallback(async () => {
    if (auth) {
      try { await authApi.logout(auth.access_token); } catch { /* ignore */ }
    }
    clearFormDraft();
    setAuth(null);
    setBtgToken(null);
    setSuccess(null);
  }, [auth]);

  const { warned, countdown, resetTimers } = useIdleTimeout(handleIdleLogout, !!auth);

  // ── beforeunload warning when form has data ───────────────────────────────
  useBeforeUnloadWarning(isDirty && !success);

  // ── Restore form draft from sessionStorage on mount ──────────────────────
  useEffect(() => {
    const draft = loadFormDraft();
    if (draft && draft.form) {
      setForm(draft.form);
      setCurrentStep(draft.step || 1);
      setIsDirty(true);
    }
  }, []);

  // ── Save form draft to sessionStorage on every change ────────────────────
  // NOTE: sessionStorage only — never localStorage. Tokens never saved here.
  useEffect(() => {
    if (!isDirty) return;
    saveFormDraft(form, currentStep);
  }, [form, currentStep, isDirty]);

  // ── Load lookups after login ──────────────────────────────────────────────
  useEffect(() => {
    if (!auth) return;
    const token = btgToken || auth.access_token;
    Promise.all([
      lookupApi.consultants(token),
      lookupApi.departments(token),
      lookupApi.wards(token),
      lookupApi.corporateClients(token),
    ]).then(([c, d, w, cc]) => {
      setConsultants(c || []);
      setDepartments(d || []);
      setWards(w || []);
      setCorporateClients(cc || []);
    }).catch(console.error);
  }, [auth, btgToken]);

  // ── Load beds when ward changes ───────────────────────────────────────────
  useEffect(() => {
    if (!auth || !form.ward_id) { setBeds([]); return; }
    lookupApi.availableBeds(btgToken || auth.access_token, form.ward_id)
      .then(b => setBeds(b || []))
      .catch(() => setBeds([]));
  }, [auth, btgToken, form.ward_id]);

  const set = useCallback((field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
    setIsDirty(true);
  }, []);

  const toggleCondition = useCallback((cond) => {
    setForm(f => ({
      ...f,
      chronic_conditions: f.chronic_conditions.includes(cond)
        ? f.chronic_conditions.filter(c => c !== cond)
        : [...f.chronic_conditions, cond],
    }));
    setIsDirty(true);
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep(step) {
    const e = {};
    if (step === 1) {
      if (!form.first_name.trim()) e.first_name = "First name is required";
      if (!form.last_name.trim())  e.last_name  = "Last name is required";
      if (!form.gender)            e.gender = "Gender is required";
      if (!form.patient_type)      e.patient_type = "Patient type is required";
      if (form.date_of_birth && new Date(form.date_of_birth) > new Date())
        e.date_of_birth = "Date of birth cannot be in the future";
      if (form.cnic && !/^\d{5}-\d{7}-\d$/.test(form.cnic.trim()))
        e.cnic = "CNIC format: 35202-1234567-1";
    }
    if (step === 2) {
      if (!form.mobile_primary.trim()) e.mobile_primary = "Mobile number is required";
      else if (!/^\+?\d{10,15}$/.test(form.mobile_primary.replace(/[\s\-]/g,"")))
        e.mobile_primary = "Mobile must be 10–15 digits";
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        e.email = "Invalid email format";
    }
    if (step === 5) {
      if (!form.consultant_id) e.consultant_id = "Consultant is required";
      if (!form.department_id) e.department_id = "Department is required";
    }
    if (step === 7) {
      const ranges = {
        temperature:      [30, 45,  "Temperature must be 30–45 °C"],
        pulse_rate:       [20, 300, "Pulse must be 20–300 bpm"],
        respiratory_rate: [1,  80,  "Resp rate must be 1–80/min"],
        bp_systolic:      [40, 300, "Systolic must be 40–300 mmHg"],
        bp_diastolic:     [20, 200, "Diastolic must be 20–200 mmHg"],
        spo2:             [50, 100, "SpO2 must be 50–100%"],
        weight_kg:        [0.5,500, "Weight must be 0.5–500 kg"],
        height_cm:        [20, 300, "Height must be 20–300 cm"],
        gcs_score:        [3,  15,  "GCS must be 3–15"],
        pain_score:       [0,  10,  "Pain score must be 0–10"],
      };
      Object.entries(ranges).forEach(([field, [min, max, msg]]) => {
        if (form[field] === "") return;
        const v = parseFloat(form[field]);
        if (isNaN(v) || v < min || v > max) e[field] = msg;
      });
    }
    if (step === 9 && !isOPD) {
      if (!form.ward_id)        e.ward_id        = "Ward is required for IPD";
      if (!form.bed_id)         e.bed_id         = "Bed is required";
      if (!form.admission_date) e.admission_date = "Admission date is required";
    }
    if (step === 10) {
      // Discount: must be 0–100
      const disc = parseFloat(form.discount_pct);
      if (isNaN(disc) || disc < 0 || disc > 100)
        e.discount_pct = "Discount must be between 0 and 100%";
      // Advance payment: must be >= 0
      if (form.advance_payment !== "" && parseFloat(form.advance_payment) < 0)
        e.advance_payment = "Payment amount cannot be negative";
      // Coverage limit: must be >= 0 if entered
      if (form.coverage_limit !== "" && parseFloat(form.coverage_limit) < 0)
        e.coverage_limit = "Coverage limit cannot be negative";
    }
    return e;
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function nextStep() {
    const e = validateStep(currentStep);
    if (Object.keys(e).length) { setErrors(e); return; }
    let next = currentStep + 1;
    if (next === 6 && !hasCorporate) next = 7;
    if (next === 9 && isOPD)        next = 10;
    setCurrentStep(Math.min(next, 10));
  }
  function prevStep() {
    let prev = currentStep - 1;
    if (prev === 6 && !hasCorporate) prev = 5;
    if (prev === 9 && isOPD)        prev = 8;
    setCurrentStep(Math.max(prev, 1));
  }
  function goToStep(s) {
    const e = validateStep(currentStep);
    if (Object.keys(e).length && s > currentStep) { setErrors(e); return; }
    if (s === 6 && !hasCorporate) return;
    if (s === 9 && isOPD)        return;
    setCurrentStep(s);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const e = validateStep(10);
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setSubmitError("");
    try {
      const payload = {
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        cnic: form.cnic,
        mobile: form.mobile_primary,
        consultant_id: form.consultant_id || null,
        department_id: form.department_id || null,
        ward_id: form.ward_id || null,
        bed_id: form.bed_id || null,
        corporate_client_id: form.corporate_company_id || null,
        visit_type: isOPD ? "OPD" : "ADMISSION",
        is_corporate: hasCorporate,
        chronic_conditions: form.chronic_conditions,
        vitals: {
          temperature: form.temperature, pulse_rate: form.pulse_rate, respiratory_rate: form.respiratory_rate,
          bp_systolic: form.bp_systolic, bp_diastolic: form.bp_diastolic, spo2: form.spo2,
          weight_kg: form.weight_kg, height_cm: form.height_cm, gcs_score: form.gcs_score, pain_score: form.pain_score,
        },
        bmi: bmi ? parseFloat(bmi) : null,
      };
      const token = btgToken || auth.access_token;
      const result = await patientsApi.register(token, payload);
      clearFormDraft(); // wipe sessionStorage on success
      setIsDirty(false);
      setSuccess({ mr_number: result.mr_number, patient_name:`${form.first_name} ${form.last_name}` });
    } catch (err) {
      setSubmitError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBTGActivated(token) {
    setBtgToken(token);
    setBtgOpen(false);
  }

  function handleLogout() {
    authApi.logout(auth.access_token).catch(() => {});
    clearFormDraft();
    setAuth(null);
    setBtgToken(null);
    setIsDirty(false);
  }

  function handleReset() {
    clearFormDraft();
    setForm(EMPTY_FORM);
    setErrors({});
    setCurrentStep(1);
    setSuccess(null);
    setSubmitError("");
    setIsDirty(false);
  }

  // ── Render: Login ─────────────────────────────────────────────────────────
  if (!auth) return <LoginScreen onLogin={setAuth} />;

  // ── Render: Success ───────────────────────────────────────────────────────
  if (success) return <SuccessScreen success={success} onNew={handleReset} auth={auth} />;

  // ── Render: Form ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#F3F4F6", fontFamily:"Inter, system-ui, sans-serif" }}>

      {/* Idle warning overlay */}
      {warned && (
        <IdleWarningBanner countdown={countdown} onStayActive={resetTimers} />
      )}

      {/* Top Bar */}
      <div style={{
        background:"#1D4ED8", color:"#fff", padding:"0 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:56, position:"sticky", top:0, zIndex:100,
        boxShadow:"0 2px 8px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>🏥</span>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>HIMS — Patient Registration</div>
            <div style={{ fontSize:11, opacity:0.75 }}>Hospital Management Information System</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {btgToken && (
            <div style={{ background:"#FEF3C7", color:"#92400E", padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:600 }}>
              ⚡ BTG Active — 15 min scope
            </div>
          )}
          <button onClick={() => setBtgOpen(true)} style={{
            background:"#DC2626", color:"#fff", border:"none",
            padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
          }}>
            🚨 Emergency Access
          </button>
          <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:20, padding:"3px 10px", fontSize:12 }}>
            👤 {auth.full_name} · {auth.role}
          </div>
          <button onClick={handleLogout} style={{
            background:"transparent", border:"1px solid rgba(255,255,255,0.4)",
            color:"#fff", padding:"3px 10px", borderRadius:20, fontSize:12, cursor:"pointer",
          }}>
            Logout
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background:"#1E3A8A", height:4 }}>
        <div style={{ height:"100%", background:"#60A5FA", width:`${(currentStep/10)*100}%`, transition:"width 0.3s ease" }} />
      </div>

      <div style={{ maxWidth:960, margin:"0 auto", padding:"24px 16px" }}>
        <StepNavigator steps={STEPS} current={currentStep} onGo={goToStep} isOPD={isOPD} hasCorporate={hasCorporate} />

        <div style={{
          background:"#fff", borderRadius:16, padding:32,
          boxShadow:"0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
          marginBottom:20,
        }}>

          {/* ── STEP 1 ── */}
          {currentStep === 1 && (<>
            <SectionTitle icon="👤" title="Personal Information" subtitle="CNIC is encrypted at rest. Searchable by exact match only." />
            <Row>
              <Field label="First Name" required error={errors.first_name}><Input value={form.first_name} onChange={e=>set("first_name",e.target.value)} placeholder="Ahmed" error={errors.first_name} /></Field>
              <Field label="Last Name" required error={errors.last_name}><Input value={form.last_name} onChange={e=>set("last_name",e.target.value)} placeholder="Khan" error={errors.last_name} /></Field>
            </Row>
            <Row>
              <Field label="Father / Husband Name"><Input value={form.father_husband_name} onChange={e=>set("father_husband_name",e.target.value)} placeholder="Muhammad Khan" /></Field>
              <Field label="Date of Birth" error={errors.date_of_birth}><Input type="date" value={form.date_of_birth} onChange={e=>set("date_of_birth",e.target.value)} max={new Date().toISOString().split("T")[0]} error={errors.date_of_birth} /></Field>
            </Row>
            <Row>
              <Field label="Gender" required error={errors.gender}><Select value={form.gender} onChange={e=>set("gender",e.target.value)} error={errors.gender}>{GENDERS.map(g=><option key={g}>{g}</option>)}</Select></Field>
              <Field label="Blood Group"><Select value={form.blood_group} onChange={e=>set("blood_group",e.target.value)}>{BLOOD_GROUPS.map(g=><option key={g}>{g}</option>)}</Select></Field>
            </Row>
            <Row>
              <Field label="Patient Type" required error={errors.patient_type}><Select value={form.patient_type} onChange={e=>set("patient_type",e.target.value)}>{PATIENT_TYPES.map(t=><option key={t}>{t}</option>)}</Select></Field>
              <Field label="Marital Status"><Select value={form.marital_status} onChange={e=>set("marital_status",e.target.value)}><option value="">Select...</option>{["Single","Married","Widowed","Divorced"].map(s=><option key={s}>{s}</option>)}</Select></Field>
            </Row>
            <Row>
              <Field label="CNIC" error={errors.cnic} hint="Stored encrypted — searchable by exact match only. Format: 35202-1234567-1"><Input value={form.cnic} onChange={e=>set("cnic",e.target.value)} placeholder="35202-1234567-1" error={errors.cnic} /></Field>
              <Field label="Occupation"><Input value={form.occupation} onChange={e=>set("occupation",e.target.value)} placeholder="Engineer, Teacher..." /></Field>
            </Row>
          </>)}

          {/* ── STEP 2 ── */}
          {currentStep === 2 && (<>
            <SectionTitle icon="📞" title="Contact Information" subtitle="Mobile numbers are encrypted at rest. Searchable by exact match." />
            <Row>
              <Field label="Mobile (Primary)" required error={errors.mobile_primary} hint="Stored encrypted. Format: +92 300 1234567"><Input value={form.mobile_primary} onChange={e=>set("mobile_primary",e.target.value)} placeholder="+92 300 1234567" type="tel" error={errors.mobile_primary} /></Field>
              <Field label="Mobile (Secondary)"><Input value={form.mobile_secondary} onChange={e=>set("mobile_secondary",e.target.value)} placeholder="+92 321 1234567" type="tel" /></Field>
            </Row>
            <Field label="Email Address" error={errors.email}><Input value={form.email} onChange={e=>set("email",e.target.value)} placeholder="patient@example.com" type="email" error={errors.email} /></Field>
            <Field label="Address Line 1"><Input value={form.address_line1} onChange={e=>set("address_line1",e.target.value)} placeholder="House 12, Street 5, Block B" /></Field>
            <Field label="Address Line 2"><Input value={form.address_line2} onChange={e=>set("address_line2",e.target.value)} placeholder="DHA Phase 2" /></Field>
            <Row cols={3}>
              <Field label="City"><Input value={form.city} onChange={e=>set("city",e.target.value)} placeholder="Lahore" /></Field>
              <Field label="Province"><Select value={form.province} onChange={e=>set("province",e.target.value)}><option value="">Select...</option>{["Punjab","Sindh","KPK","Balochistan","AJK","GB","ICT"].map(p=><option key={p}>{p}</option>)}</Select></Field>
              <Field label="Postal Code"><Input value={form.postal_code} onChange={e=>set("postal_code",e.target.value)} placeholder="54000" /></Field>
            </Row>
          </>)}

          {/* ── STEP 3 ── */}
          {currentStep === 3 && (<>
            <SectionTitle icon="🚨" title="Emergency Contact" subtitle="Person to contact if patient cannot communicate." />
            <Row>
              <Field label="Contact Name"><Input value={form.emergency_contact_name} onChange={e=>set("emergency_contact_name",e.target.value)} placeholder="Sara Khan" /></Field>
              <Field label="Relation"><Select value={form.emergency_contact_relation} onChange={e=>set("emergency_contact_relation",e.target.value)}><option value="">Select...</option>{["Spouse","Parent","Child","Sibling","Friend","Guardian","Other"].map(r=><option key={r}>{r}</option>)}</Select></Field>
            </Row>
            <Field label="Contact Mobile"><Input value={form.emergency_contact_mobile} onChange={e=>set("emergency_contact_mobile",e.target.value)} placeholder="+92 300 9876543" type="tel" /></Field>
          </>)}

          {/* ── STEP 4 ── */}
          {currentStep === 4 && (<>
            <SectionTitle icon="👨‍👩‍👧" title="Next of Kin" subtitle="Legal next of kin for consent documentation." />
            <Row>
              <Field label="Full Name"><Input value={form.nok_name} onChange={e=>set("nok_name",e.target.value)} placeholder="Imran Khan" /></Field>
              <Field label="Relation"><Select value={form.nok_relation} onChange={e=>set("nok_relation",e.target.value)}><option value="">Select...</option>{["Spouse","Father","Mother","Son","Daughter","Brother","Sister","Guardian","Other"].map(r=><option key={r}>{r}</option>)}</Select></Field>
            </Row>
            <Row>
              <Field label="CNIC"><Input value={form.nok_cnic} onChange={e=>set("nok_cnic",e.target.value)} placeholder="35202-9876543-2" /></Field>
              <Field label="Mobile"><Input value={form.nok_mobile} onChange={e=>set("nok_mobile",e.target.value)} placeholder="+92 311 1234567" type="tel" /></Field>
            </Row>
            <Field label="Address"><Textarea value={form.nok_address} onChange={e=>set("nok_address",e.target.value)} placeholder="Full address of next of kin" /></Field>
          </>)}

          {/* ── STEP 5 ── */}
          {currentStep === 5 && (<>
            <SectionTitle icon="🏥" title="Referral & Visit Details" />
            <Row>
              <Field label="Referral Source"><Select value={form.referral_source} onChange={e=>set("referral_source",e.target.value)}>{REFERRAL_SRC.map(r=><option key={r}>{r}</option>)}</Select></Field>
              <Field label="Visit Type"><Select value={form.visit_type} onChange={e=>set("visit_type",e.target.value)}>{VISIT_TYPES.map(v=><option key={v}>{v}</option>)}</Select></Field>
            </Row>
            <Field label="Referring Doctor Name"><Input value={form.referring_doctor} onChange={e=>set("referring_doctor",e.target.value)} placeholder="Dr. Name (if referred)" /></Field>
            <Row>
              <Field label="Consultant" required error={errors.consultant_id}><Select value={form.consultant_id} onChange={e=>set("consultant_id",e.target.value)} error={errors.consultant_id}><option value="">Select consultant...</option>{consultants.map(c=><option key={c.id} value={c.id}>{c.name} — {c.specialisation}</option>)}</Select></Field>
              <Field label="Department" required error={errors.department_id}><Select value={form.department_id} onChange={e=>set("department_id",e.target.value)} error={errors.department_id}><option value="">Select department...</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
            </Row>
            <Field label="Payment Category"><Select value={form.payment_category} onChange={e=>set("payment_category",e.target.value)}>{["Self","Corporate","Insurance","Welfare","Complimentary"].map(p=><option key={p}>{p}</option>)}</Select></Field>
          </>)}

          {/* ── STEP 6 (conditional) ── */}
          {currentStep === 6 && (<>
            <SectionTitle icon="🛡️" title="Insurance & Corporate Details" subtitle="Only shown when payment category is Corporate, Insurance, or Welfare." />
            <Row>
              <Field label="Corporate / Insurance Company"><Select value={form.corporate_company_id} onChange={e=>set("corporate_company_id",e.target.value)}><option value="">Select company...</option>{corporateClients.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</Select></Field>
              <Field label="Insurance Company Name"><Input value={form.insurance_company} onChange={e=>set("insurance_company",e.target.value)} placeholder="State Life, Jubilee..." /></Field>
            </Row>
            <Row>
              <Field label="Policy Number"><Input value={form.policy_number} onChange={e=>set("policy_number",e.target.value)} placeholder="POL-2025-XXXXX" /></Field>
              <Field label="Policy Validity Date"><Input type="date" value={form.policy_validity} onChange={e=>set("policy_validity",e.target.value)} /></Field>
            </Row>
            <Field label="Coverage Limit (PKR)" error={errors.coverage_limit} hint="Must be 0 or greater"><Input type="number" value={form.coverage_limit} onChange={e=>set("coverage_limit",e.target.value)} placeholder="500000" min="0" error={errors.coverage_limit} /></Field>
          </>)}

          {/* ── STEP 7 ── */}
          {currentStep === 7 && (<>
            <SectionTitle icon="💓" title="Vital Signs & Triage" subtitle="Cards light up as you fill them in. All values are range-validated." />
            {bmi && (
              <div style={{ background:`${bmiCat.color}12`, border:`2px solid ${bmiCat.color}`, borderRadius:12, padding:"12px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:26 }}>📊</span>
                <div>
                  <div style={{ fontSize:12, color:"#6B7280" }}>BMI (auto-calculated)</div>
                  <div style={{ fontSize:22, fontWeight:700, color:bmiCat.color }}>{bmi} <span style={{ fontSize:13, fontWeight:500 }}>— {bmiCat.label}</span></div>
                </div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:24 }}>
              <VitalCard icon="🌡️" label="Temp" value={form.temperature} unit="°C" color="#EF4444" />
              <VitalCard icon="❤️" label="Pulse" value={form.pulse_rate} unit="bpm" color="#EC4899" />
              <VitalCard icon="🩸" label="BP" value={form.bp_systolic&&form.bp_diastolic?`${form.bp_systolic}/${form.bp_diastolic}`:""} unit="mmHg" color="#8B5CF6" />
              <VitalCard icon="💨" label="SpO2" value={form.spo2} unit="%" color="#06B6D4" />
            </div>
            <Row>
              <Field label="Temperature (°C)" error={errors.temperature} hint="Range: 30–45 °C"><Input type="number" value={form.temperature} onChange={e=>set("temperature",e.target.value)} placeholder="37.0" step="0.1" min="30" max="45" error={errors.temperature} /></Field>
              <Field label="Pulse Rate (bpm)" error={errors.pulse_rate} hint="Range: 20–300"><Input type="number" value={form.pulse_rate} onChange={e=>set("pulse_rate",e.target.value)} placeholder="72" min="20" max="300" error={errors.pulse_rate} /></Field>
            </Row>
            <Row>
              <Field label="BP Systolic (mmHg)" error={errors.bp_systolic}><Input type="number" value={form.bp_systolic} onChange={e=>set("bp_systolic",e.target.value)} placeholder="120" min="40" max="300" error={errors.bp_systolic} /></Field>
              <Field label="BP Diastolic (mmHg)" error={errors.bp_diastolic}><Input type="number" value={form.bp_diastolic} onChange={e=>set("bp_diastolic",e.target.value)} placeholder="80" min="20" max="200" error={errors.bp_diastolic} /></Field>
            </Row>
            <Row>
              <Field label="Respiratory Rate (/min)" error={errors.respiratory_rate}><Input type="number" value={form.respiratory_rate} onChange={e=>set("respiratory_rate",e.target.value)} placeholder="16" min="1" max="80" error={errors.respiratory_rate} /></Field>
              <Field label="SpO2 (%)" error={errors.spo2} hint="Range: 50–100%"><Input type="number" value={form.spo2} onChange={e=>set("spo2",e.target.value)} placeholder="98" min="50" max="100" step="0.1" error={errors.spo2} /></Field>
            </Row>
            <Row>
              <Field label="Weight (kg)" error={errors.weight_kg}><Input type="number" value={form.weight_kg} onChange={e=>set("weight_kg",e.target.value)} placeholder="70" step="0.1" min="0.5" max="500" error={errors.weight_kg} /></Field>
              <Field label="Height (cm)" error={errors.height_cm} hint="BMI auto-calculates from weight + height"><Input type="number" value={form.height_cm} onChange={e=>set("height_cm",e.target.value)} placeholder="170" step="0.5" min="20" max="300" error={errors.height_cm} /></Field>
            </Row>
            <Row>
              <Field label="GCS Score (3–15)" error={errors.gcs_score} hint="3=coma, 15=fully conscious"><Input type="number" value={form.gcs_score} onChange={e=>set("gcs_score",e.target.value)} placeholder="15" min="3" max="15" error={errors.gcs_score} /></Field>
              <Field label="Pain Score (0–10)" error={errors.pain_score} hint="0=no pain, 10=worst imaginable"><Input type="number" value={form.pain_score} onChange={e=>set("pain_score",e.target.value)} placeholder="0" min="0" max="10" error={errors.pain_score} /></Field>
            </Row>
            <Field label="Chief Complaint"><Textarea value={form.chief_complaint} onChange={e=>set("chief_complaint",e.target.value)} placeholder="Primary reason for visit..." /></Field>
          </>)}

          {/* ── STEP 8 ── */}
          {currentStep === 8 && (<>
            <SectionTitle icon="📋" title="Medical History" />
            <Field label="Known Allergies" hint="Include drug, food, and environmental allergies"><Textarea value={form.known_allergies} onChange={e=>set("known_allergies",e.target.value)} placeholder="Penicillin, NSAIDs, Peanuts..." /></Field>
            <Field label="Current Medications"><Textarea value={form.current_medications} onChange={e=>set("current_medications",e.target.value)} placeholder="Metformin 500mg, Lisinopril 10mg..." /></Field>
            <Field label="Chronic Conditions" hint="Toggle all that apply">
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:4 }}>
                {CHRONIC_CONDITIONS.map(cond => {
                  const active = form.chronic_conditions.includes(cond);
                  return (
                    <button key={cond} type="button" onClick={() => toggleCondition(cond)} style={{
                      padding:"6px 12px", borderRadius:20, fontSize:13, fontWeight:500,
                      border:`2px solid ${active?"#1D4ED8":"#E5E7EB"}`,
                      background:active?"#EFF6FF":"#fff", color:active?"#1D4ED8":"#6B7280",
                      cursor:"pointer", transition:"all 0.15s",
                    }}>
                      {active?"✓ ":""}{cond}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Row>
              <Field label="Smoking Status"><Select value={form.smoking_status} onChange={e=>set("smoking_status",e.target.value)}>{["Never","Former Smoker","Current Smoker","Unknown"].map(s=><option key={s}>{s}</option>)}</Select></Field>
            </Row>
            <Field label="Family History"><Textarea value={form.family_history} onChange={e=>set("family_history",e.target.value)} placeholder="Diabetes (father), hypertension (mother)..." /></Field>
          </>)}

          {/* ── STEP 9 (IPD only) ── */}
          {currentStep === 9 && !isOPD && (<>
            <SectionTitle icon="🛏️" title="Admission Details" subtitle="IPD and Emergency patients only. OPD skips this step." />
            <Row>
              <Field label="Ward" required error={errors.ward_id}><Select value={form.ward_id} onChange={e=>{set("ward_id",e.target.value); set("bed_id","");}} error={errors.ward_id}><option value="">Select ward...</option>{wards.map(w=><option key={w.id} value={w.id}>{w.name} ({w.available_beds} beds available)</option>)}</Select></Field>
              <Field label="Bed" required error={errors.bed_id}><Select value={form.bed_id} onChange={e=>set("bed_id",e.target.value)} error={errors.bed_id} disabled={!form.ward_id}><option value="">Select bed...</option>{beds.map(b=><option key={b.id} value={b.id}>{b.bed_number} — {b.bed_type}</option>)}</Select></Field>
            </Row>
            <Row>
              <Field label="Admission Date & Time" required error={errors.admission_date}><Input type="datetime-local" value={form.admission_date} onChange={e=>set("admission_date",e.target.value)} error={errors.admission_date} /></Field>
              <Field label="Expected Discharge Date"><Input type="date" value={form.expected_discharge} onChange={e=>set("expected_discharge",e.target.value)} /></Field>
            </Row>
            <Field label="Advance Payment (PKR)" error={errors.advance_payment} hint="Must be 0 or greater"><Input type="number" value={form.advance_payment} onChange={e=>set("advance_payment",e.target.value)} placeholder="0.00" min="0" step="100" error={errors.advance_payment} /></Field>
          </>)}

          {/* ── STEP 10 ── */}
          {currentStep === 10 && (<>
            <SectionTitle icon="💳" title="Financial & Registration Summary" subtitle="Review all details before final submission." />
            <Row>
              <Field label="Payment Mode"><Select value={form.payment_mode} onChange={e=>set("payment_mode",e.target.value)}>{PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}</Select></Field>
              <Field label="Discount (%)" error={errors.discount_pct} hint="Must be 0–100">
                <Input type="number" value={form.discount_pct} onChange={e=>set("discount_pct",e.target.value)} min="0" max="100" step="0.5" placeholder="0" error={errors.discount_pct} />
              </Field>
            </Row>
            {form.payment_mode === "Welfare" && (
              <Field label="Welfare Notes"><Textarea value={form.welfare_notes} onChange={e=>set("welfare_notes",e.target.value)} placeholder="Welfare case details..." /></Field>
            )}
            {/* Summary */}
            <div style={{ background:"#F0F9FF", border:"1.5px solid #BAE6FD", borderRadius:12, padding:20, marginTop:16 }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:14, color:"#0C4A6E" }}>📋 Registration Summary — Verify before submitting</div>
              {[
                ["Patient", `${form.first_name} ${form.last_name}${form.date_of_birth?` · DOB: ${form.date_of_birth}`:""}`],
                ["Type", `${form.patient_type} · ${form.gender}`],
                ["Mobile", form.mobile_primary || "—"],
                ["Consultant", consultants.find(c=>c.id==form.consultant_id)?.name || "Not selected"],
                ["Department", departments.find(d=>d.id==form.department_id)?.name || "Not selected"],
                ["Payment", `${form.payment_mode} · Discount: ${form.discount_pct}%`],
                form.chronic_conditions.length>0 && ["Conditions", form.chronic_conditions.join(", ")],
                bmi && ["BMI", `${bmi} (${bmiCat?.label})`],
                !isOPD && form.ward_id && ["Ward", wards.find(w=>w.id==form.ward_id)?.name||"—"],
              ].filter(Boolean).map(([k,v])=>(
                <div key={k} style={{ display:"flex", gap:8, marginBottom:6, fontSize:13 }}>
                  <span style={{ color:"#6B7280", minWidth:130, fontWeight:500 }}>{k}</span>
                  <span style={{ color:"#111827" }}>{v}</span>
                </div>
              ))}
            </div>
            {submitError && (
              <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:"12px 16px", marginTop:16, color:"#DC2626", fontSize:14 }}>
                ⚠ {submitError}
              </div>
            )}
          </>)}
        </div>

        {/* Navigation */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", borderRadius:12, padding:"16px 24px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
          <button onClick={prevStep} disabled={currentStep===1} style={{
            padding:"10px 24px", borderRadius:8, fontSize:14, fontWeight:600,
            border:"1.5px solid #D1D5DB", background:"#fff", color:"#374151",
            cursor:currentStep===1?"not-allowed":"pointer", opacity:currentStep===1?0.4:1,
          }}>
            ← Previous
          </button>
          <span style={{ fontSize:13, color:"#9CA3AF" }}>Step {currentStep} of 10</span>
          {currentStep < 10
            ? <button onClick={nextStep} style={{ padding:"10px 28px", borderRadius:8, fontSize:14, fontWeight:600, background:"#1D4ED8", color:"#fff", border:"none", cursor:"pointer" }}>Next →</button>
            : <button onClick={handleSubmit} disabled={loading} style={{ padding:"10px 32px", borderRadius:8, fontSize:14, fontWeight:700, background:loading?"#9CA3AF":"#16A34A", color:"#fff", border:"none", cursor:loading?"not-allowed":"pointer" }}>
                {loading ? "⏳ Registering..." : "✓ Register Patient"}
              </button>
          }
        </div>
      </div>

      {btgOpen && <BTGModal auth={auth} onActivated={handleBTGActivated} onClose={()=>setBtgOpen(false)} />}
    </div>
  );
}

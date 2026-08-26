export type StaffRole = "reception" | "nurse" | "doctor" | "pharmacy" | "pharmacist" | "lab" | "lab_tech";

export type FacilityStaff = {
  role: StaffRole;
  facility_id: string;
  staff_code: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  must_change_password: boolean;
  facility_staff: FacilityStaff;
  patient: unknown | null;
};

export type Session = { user: AuthUser };

export type PatientSummary = {
  id: string;
  digital_health_id: string;
  name: string;
  dob: string;
  sex: string;
  phone: string | null;
};

export type VisitStatus = "waiting" | "completed" | "cancelled" | string;

export type Visit = {
  id: string;
  patient: PatientSummary;
  facility_id: string;
  checked_in_by: string;
  checked_in_at: string;
  status: VisitStatus;
  completed_at: string | null;
};

export type Vitals = {
  id: string;
  visit_id: string;
  patient_id: string;
  recorded_by: string;
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  temperature: number | string;
  pulse: number;
  respiratory_rate: number;
  spo2: number;
  weight: number | string;
  height: number | string;
  recorded_at: string;
};

export type EncounterStatus = "draft" | "finalized" | string;

export type Prescription = {
  id: string;
  encounter_id: string;
  patient_id: string;
  doctor_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string | null;
  status: string;
  issued_at: string;
  forwarded_to_facility_id: string | null;
  forward_status: string | null;
};

export type Encounter = {
  id: string;
  visit_id: string;
  patient_id: string;
  doctor_id: string;
  facility_id: string;
  symptoms: string | null;
  assessment: string | null;
  diagnosis: string | null;
  notes: string | null;
  status: EncounterStatus;
  finalized_at: string | null;
  superseded_by_id: string | null;
  prescriptions?: Prescription[];
  created_at: string;
};

export type LabRequest = {
  id: string;
  encounter_id: string;
  patient_id: string;
  ordered_by: string;
  facility_id: string;
  forwarded_to_facility_id: string | null;
  test_name: string;
  notes?: string | null;
  status: string;
  ordered_at: string;
  doctor?: Pick<AuthUser, "id" | "name" | "email" | "phone">;
  facility?: Pick<Facility, "id" | "type" | "name" | "address" | "phone">;
};

export type PaginationMeta = {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
};

export type Paginated<T> = {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: PaginationMeta;
};

export type UploadedFile = {
  public_id: string;
  url: string;
  format?: string;
  bytes?: number;
};

export type LabResultPayload = {
  result_text: string;
  values: Record<string, string>;
  file_urls: string[];
};

export type AiDifferentialDiagnosis = {
  condition: string;
  likelihood: "high" | "medium" | "low" | string;
  reasoning: string;
};

export type AiDiagnosisSuggestion = {
  summary: string;
  differential_diagnoses: AiDifferentialDiagnosis[];
  recommended_next_steps: string[];
  red_flags: string[];
  disclaimer: string;
  model: string;
  generated_at: string;
};

export type AppointmentPatient = {
  id: string;
  digital_health_id: string;
  name: string;
  dob: string;
  sex: string;
  blood_group: string | null;
  allergies: string | null;
  phone: string | null;
  photo_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  guardian_patient_id: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  facility_id: string;
  type: "clinic_visit" | string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | string;
  fee: string | null;
  notes: string | null;
  facility: Pick<Facility, "id" | "type" | "name" | "address" | "phone" | "logo_url"> & { latitude: string | null; longitude: string | null };
  patient: AppointmentPatient;
};

export type Facility = {
  id: string;
  type: "hospital" | "pharmacy" | "lab" | string;
  name: string;
  address: string | null;
  phone: string | null;
  email?: string | null;
  logo_url?: string | null;
  status?: "active" | string;
};

export type FacilityPrescription = Prescription & {
  doctor?: Pick<AuthUser, "id" | "name" | "email" | "phone">;
  facility?: Pick<Facility, "id" | "type" | "name" | "address" | "phone">;
};

export type TimelineItem = {
  type: "prescription" | "encounter" | "vitals" | string;
  at: string;
  data: Prescription | Encounter | Vitals | Record<string, unknown>;
};

type Envelope<T> = { success: boolean; message: string; data: T };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.message || "The request could not be completed.", response.status);
  }
  return payload.data;
}

function json(method: "POST" | "PATCH", body?: unknown): RequestInit {
  return { method, body: body === undefined ? undefined : JSON.stringify(body) };
}

export const meditrustApi = {
  getMyFacility: () => api<Facility>("/v1/facilities/me"),
  searchPatients: (query: string) => api<PatientSummary[]>(`/v1/patients/search?query=${encodeURIComponent(query)}`),
  listVisits: async (facilityId: string, status = "waiting") => {
    const result = await api<{ data: Visit[] }>(`/v1/facilities/${encodeURIComponent(facilityId)}/visits?status=${encodeURIComponent(status)}`);
    return result.data;
  },
  getVisit: (visitId: string) => api<Visit>(`/v1/visits/${encodeURIComponent(visitId)}`),
  checkIn: (facilityId: string, digitalHealthId: string) => api<Visit>(`/v1/facilities/${encodeURIComponent(facilityId)}/visits`, json("POST", { digital_health_id: digitalHealthId })),
  updateVisitStatus: (visitId: string, status: "completed" | "cancelled") => api<Visit>(`/v1/visits/${encodeURIComponent(visitId)}/status`, json("PATCH", { status })),
  recordVitals: (visitId: string, values: Omit<Vitals, "id" | "visit_id" | "patient_id" | "recorded_by" | "recorded_at">) => api<Vitals>(`/v1/visits/${encodeURIComponent(visitId)}/vitals`, json("POST", values)),
  getVitals: (patientId: string) => api<Vitals[]>(`/v1/patients/${encodeURIComponent(patientId)}/vitals`),
  getTimeline: (patientId: string) => api<TimelineItem[]>(`/v1/patients/${encodeURIComponent(patientId)}/timeline`),
  getDoctorAppointments: () => api<Appointment[]>("/v1/doctor/appointments"),
  getAiDiagnosisSuggestion: (encounterId: string) => api<AiDiagnosisSuggestion>(`/v1/encounters/${encodeURIComponent(encounterId)}/ai-diagnosis-suggestion`, json("POST")),
  createEncounter: (visitId: string, values: Pick<Encounter, "symptoms" | "assessment" | "diagnosis">) => api<Encounter>(`/v1/visits/${encodeURIComponent(visitId)}/encounters`, json("POST", values)),
  updateEncounter: (encounterId: string, values: Partial<Pick<Encounter, "symptoms" | "assessment" | "diagnosis" | "notes">>) => api<Encounter>(`/v1/encounters/${encodeURIComponent(encounterId)}`, json("PATCH", values)),
  finalizeEncounter: (encounterId: string) => api<Encounter>(`/v1/encounters/${encodeURIComponent(encounterId)}/finalize`, json("PATCH")),
  amendEncounter: (encounterId: string, values: Partial<Pick<Encounter, "symptoms" | "assessment" | "diagnosis" | "notes">>) => api<Encounter>(`/v1/encounters/${encodeURIComponent(encounterId)}/amend`, json("POST", values)),
  createPrescription: (encounterId: string, values: Omit<Prescription, "id" | "encounter_id" | "patient_id" | "doctor_id" | "status" | "issued_at" | "forwarded_to_facility_id" | "forward_status">) => api<Prescription>(`/v1/encounters/${encodeURIComponent(encounterId)}/prescriptions`, json("POST", values)),
  forwardPrescription: (prescriptionId: string, pharmacyFacilityId: string) => api<Prescription>(`/v1/prescriptions/${encodeURIComponent(prescriptionId)}/forward`, json("POST", { pharmacy_facility_id: pharmacyFacilityId })),
  createLabRequest: (encounterId: string, testName: string, notes: string) => api<LabRequest>(`/v1/encounters/${encodeURIComponent(encounterId)}/lab-requests`, json("POST", { test_name: testName, notes })),
  forwardLabRequest: (labRequestId: string, labFacilityId: string) => api<LabRequest>(`/v1/lab-requests/${encodeURIComponent(labRequestId)}/forward`, json("POST", { lab_facility_id: labFacilityId })),
  listFacilityLabRequests: (facilityId: string, page: number, perPage = 20) => api<Paginated<LabRequest>>(`/v1/facilities/${encodeURIComponent(facilityId)}/lab-requests?page=${page}&per_page=${perPage}`),
  submitLabResult: (labRequestId: string, payload: LabResultPayload) => api<LabRequest>(`/v1/lab-requests/${encodeURIComponent(labRequestId)}/result`, json("POST", payload)),
  uploadFile: (file: File, folder = "lab-results") => {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    return api<UploadedFile>("/v1/uploads", { method: "POST", body });
  },
  listFacilityPrescriptions: (facilityId: string, page: number, perPage = 20) => api<Paginated<FacilityPrescription>>(`/v1/facilities/${encodeURIComponent(facilityId)}/prescriptions?page=${page}&per_page=${perPage}`),
  dispensePrescription: (prescriptionId: string) => api<FacilityPrescription>(`/v1/prescriptions/${encodeURIComponent(prescriptionId)}/dispense`, json("PATCH")),
  directory: (type: "pharmacy" | "lab") => api<Facility[]>(`/v1/facilities/directory?type=${type}`),
};

const SESSION_KEY = "meditrust_session";

export function saveSession(session: Session, remember: boolean) {
  const selected = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(SESSION_KEY);
  selected.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    return session?.user?.facility_staff?.role ? session : null;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ageFromDob(dob: string) {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return age;
}

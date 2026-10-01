export type StaffRole = "reception" | "nurse" | "doctor" | "pharmacy" | "pharmacist" | "lab" | "lab_tech" | "finance";

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

export type WalkInPatientInput = {
  name: string;
  dob: string;
  sex: "female" | "male";
  phone: string;
  consent_accepted: true;
};

export type WalkInPatientResult = {
  patient: PatientSummary;
  print_url: string;
};

export type WalkInCheckInInput = {
  consent_accepted: true;
  consent_method: "verbal" | "signed_form";
  consent_reference?: string;
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

export type CheckInRequestStatus = "pending" | "waiting" | "cancelled" | "expired" | string;

export type CheckInRequest = {
  id: string;
  patient: Pick<PatientSummary, "id" | "digital_health_id" | "name">;
  status: CheckInRequestStatus;
  otp_sent: boolean;
  facility_id?: string;
  reason?: string | null;
};

export type Vitals = {
  id: string;
  visit_id: string;
  patient_id: string;
  recorded_by: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  temperature: number | string | null;
  pulse: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  weight: number | string | null;
  height: number | string | null;
  recorded_at: string;
};

export type EncounterStatus = "draft" | "finalized" | string;

export type PaymentStatus = "unpaid" | "paid" | "waived";

export type PaymentUpdate = { amount: number; payment_status: PaymentStatus };

export type Prescription = {
  id: string;
  encounter_id: string;
  patient_id: string;
  patient?: Pick<PatientSummary, "id" | "digital_health_id" | "name" | "dob" | "sex">;
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
  amount: string | null;
  payment_status: PaymentStatus;
  paid_at: string | null;
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
  lab_requests?: LabRequest[];
  created_at: string;
};

export type LabResult = {
  result_text: string | null;
  values: Record<string, string> | null;
  file_urls: string[] | null;
  resulted_at: string | null;
};

export type LabRequest = {
  id: string;
  encounter_id: string;
  patient_id: string;
  patient?: Pick<PatientSummary, "id" | "digital_health_id" | "name" | "dob" | "sex">;
  ordered_by: string;
  facility_id: string;
  forwarded_to_facility_id: string | null;
  test_name: string;
  notes?: string | null;
  status: string;
  ordered_at: string;
  amount: string | null;
  payment_status: PaymentStatus;
  paid_at: string | null;
  result?: LabResult | null;
  doctor?: Pick<AuthUser, "id" | "name" | "email" | "phone">;
  facility?: Pick<Facility, "id" | "type" | "name" | "address" | "phone">;
  forwarded_to_facility?: Pick<Facility, "id" | "type" | "name" | "address" | "phone">;
};

export type LabCatalogItem = {
  id: string;
  code: string;
  type: "lab" | string;
  name: string;
  category: string | null;
  specimen: string | null;
  aliases: string[];
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

export type SupportCategory = "general" | "account" | "technical" | "billing" | "facility" | "clinical";
export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SupportMessage = {
  id: string;
  message: string;
  is_admin_reply: boolean;
  sender: { id: string; name: string };
  created_at: string;
};
export type SupportTicket = {
  id: string;
  ticket_number: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: string;
  messages_count: number;
  last_message_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: { id: string; name: string; email: string; phone: string | null };
  messages?: SupportMessage[];
};

export type UploadedFile = {
  public_id: string;
  url: string;
  format?: string;
  bytes?: number;
};

export type FinanceStatsBucket = { count: number; amount: number };

export type FinanceStatsSection = {
  total: number;
  paid: FinanceStatsBucket;
  unpaid: FinanceStatsBucket;
  waived: FinanceStatsBucket;
};

export type FinanceStats = {
  facility_ids: string[];
  filters: { from: string | null; to: string | null; payment_status: PaymentStatus | null };
  prescriptions: FinanceStatsSection;
  lab_requests: FinanceStatsSection;
  combined: { total_collected: number; total_outstanding: number; total_waived: number };
};

export type LabResultPayload = {
  result_text: string;
  values: Record<string, string>;
  file_urls: string[];
};

export type LabRequestFilters = {
  status?: string;
  paymentStatus?: PaymentStatus;
  search?: string;
  orderedFrom?: string;
  orderedTo?: string;
  perPage?: number;
};

export type PrescriptionFilters = {
  status?: "active" | "completed" | "cancelled";
  forwardStatus?: "pending" | "received" | "dispensed";
  paymentStatus?: PaymentStatus;
  search?: string;
  issuedFrom?: string;
  issuedTo?: string;
  perPage?: number;
};

export type AiDifferentialDiagnosis = {
  condition: string;
  likelihood: "high" | "medium" | "low" | string;
  reasoning: string;
};

export type AiDiagnosisSuggestion = {
  diagnosis: string;
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

export type RecordSource = "clinician_verified" | "patient_reported" | string;

export type AllergyRecord = { id: string; allergen: string; severity: "mild" | "moderate" | "severe" | string | null; reaction?: string | null; source: RecordSource };

export type ConditionRecord = { id: string; name: string; status: "active" | "resolved" | string; diagnosed_on?: string | null; notes?: string | null; source: RecordSource };

export type ReportedMedication = { id: string; name: string; dosage: string | null; frequency: string | null; route: string | null; is_current: boolean; started_on: string | null; stopped_on: string | null; source: RecordSource };

export type MedicalHistoryEntry = { id: string; type: "surgery" | "hospitalization" | "immunization" | string; title: string; occurred_on: string | null; facility_name: string | null; notes?: string | null; source: RecordSource };

export type CurrentMedication = { source_kind: "prescription" | "reported" | string; id: string; name: string; dosage: string | null; frequency: string | null; duration_days?: number | null; issued_at?: string | null; facility?: string | null; source: RecordSource };

export type PatientProfile = AppointmentPatient & {
  genotype: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  allergies: string[];
  allergy_records: AllergyRecord[];
  address: string | null;
  profile_completed_at: string | null;
};

export type ClinicalSnapshot = {
  patient: Pick<PatientSummary, "id" | "digital_health_id" | "name" | "dob" | "sex"> & { age: number };
  blood_group: string | null;
  genotype: string | null;
  allergies: AllergyRecord[];
  chronic_conditions: ConditionRecord[];
  current_medications: CurrentMedication[];
  vitals: { recorded_at: string; blood_pressure: string | null; temperature: number | null; pulse: number | null; respiratory_rate: number | null; spo2: number | null; weight_kg: number | null; height_cm: number | null; bmi: number | null } | null;
  primary_facility: { id: string; name: string; last_encounter_at: string | null } | null;
  last_encounter_at: string | null;
};

type NamedRef = { id: string; name: string };

export type RecordEncounter = Encounter & { doctor?: NamedRef; facility?: NamedRef };

export type RecordAppointment = Omit<Appointment, "patient" | "facility"> & {
  doctor?: Pick<AuthUser, "id" | "name" | "email" | "phone"> & { specialty?: string | null };
  facility?: Pick<Facility, "id" | "type" | "name">;
};

export type Referral = { id: string; patient_id: string; from_facility_id: string; to_facility_id: string; from_user_id: string; reason: string | null; status: string; created_at: string; to_facility?: NamedRef; from_facility?: NamedRef };

export type PatientFullRecord = {
  patient: PatientProfile;
  guardian: Pick<PatientSummary, "id" | "digital_health_id" | "name" | "phone"> | null;
  snapshot: ClinicalSnapshot;
  health_profile: { allergies: AllergyRecord[]; conditions: ConditionRecord[]; medications: ReportedMedication[]; medical_history: MedicalHistoryEntry[] };
  visits: (Omit<Visit, "patient" | "facility_id" | "checked_in_by"> & { facility?: NamedRef })[];
  vitals: Vitals[];
  encounters: RecordEncounter[];
  prescriptions: FacilityPrescription[];
  lab_requests: LabRequest[];
  referrals: Referral[];
  appointments: RecordAppointment[];
  counts: Record<"visits" | "encounters" | "prescriptions" | "lab_requests" | "referrals" | "appointments", number>;
  limit: number;
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

function prescriptionFiltersQuery(page: number, filters: PrescriptionFilters) {
  const query = new URLSearchParams({ page: String(page), per_page: String(filters.perPage || 20) });
  if (filters.status) query.set("status", filters.status);
  if (filters.forwardStatus) query.set("forward_status", filters.forwardStatus);
  if (filters.paymentStatus) query.set("payment_status", filters.paymentStatus);
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  if (filters.issuedFrom) query.set("issued_from", filters.issuedFrom);
  if (filters.issuedTo) query.set("issued_to", filters.issuedTo);
  return query;
}

export const meditrustApi = {
  listSupportTickets: (search = "", page = 1) => {
    const query = new URLSearchParams({ per_page: "20", page: String(page) });
    if (search.trim()) query.set("search", search.trim());
    return api<Paginated<SupportTicket>>(`/v1/support/tickets?${query}`);
  },
  getSupportTicket: (id: string) => api<SupportTicket>(`/v1/support/tickets/${encodeURIComponent(id)}`),
  createSupportTicket: (values: { subject: string; category: SupportCategory; priority: SupportPriority; message: string }) => api<SupportTicket>("/v1/support/tickets", json("POST", values)),
  replyToSupportTicket: (id: string, message: string) => api<SupportTicket>(`/v1/support/tickets/${encodeURIComponent(id)}/messages`, json("POST", { message })),
  closeSupportTicket: (id: string) => api<SupportTicket>(`/v1/support/tickets/${encodeURIComponent(id)}/close`, json("PATCH")),
  getMyFacility: () => api<Facility>("/v1/facilities/me"),
  searchPatients: (query: string) => api<PatientSummary[]>(`/v1/patients/search?query=${encodeURIComponent(query)}`),
  registerWalkInPatient: (facilityId: string, values: WalkInPatientInput) => api<WalkInPatientResult>(`/v1/facilities/${encodeURIComponent(facilityId)}/walk-in-patients`, json("POST", values)),
  checkInWalkInPatient: async (facilityId: string, patientId: string, values: WalkInCheckInInput) => {
    const result = await api<Visit | { visit: Visit }>(`/v1/facilities/${encodeURIComponent(facilityId)}/walk-in-patients/${encodeURIComponent(patientId)}/check-in`, json("POST", values));
    return "visit" in result ? result.visit : result;
  },
  walkInPrintPath: (facilityId: string, patientId: string) => `/api/backend/v1/facilities/${encodeURIComponent(facilityId)}/walk-in-patients/${encodeURIComponent(patientId)}/print`,
  listVisits: async (facilityId: string, status = "waiting") => {
    const result = await api<{ data: Visit[] }>(`/v1/facilities/${encodeURIComponent(facilityId)}/visits?status=${encodeURIComponent(status)}`);
    return result.data;
  },
  getVisit: (visitId: string) => api<Visit>(`/v1/visits/${encodeURIComponent(visitId)}`),
  checkIn: (facilityId: string, digitalHealthId: string) => api<CheckInRequest>(`/v1/facilities/${encodeURIComponent(facilityId)}/check-in-requests`, json("POST", { digital_health_id: digitalHealthId })),
  listCheckInRequests: async (facilityId: string, status = "pending") => {
    const result = await api<{ data: CheckInRequest[] }>(`/v1/facilities/${encodeURIComponent(facilityId)}/check-in-requests?status=${encodeURIComponent(status)}`);
    return result.data;
  },
  verifyCheckInOtp: (checkInRequestId: string, otp: string) => api<Visit>(`/v1/check-in-requests/${encodeURIComponent(checkInRequestId)}/verify-otp`, json("POST", { otp })),
  resendCheckInOtp: (checkInRequestId: string) => api<{ otp_sent: boolean }>(`/v1/check-in-requests/${encodeURIComponent(checkInRequestId)}/resend-otp`, json("POST")),
  cancelCheckInRequest: (checkInRequestId: string, reason: string) => api<CheckInRequest>(`/v1/check-in-requests/${encodeURIComponent(checkInRequestId)}/cancel`, json("POST", { reason })),
  updateVisitStatus: (visitId: string, status: "completed" | "cancelled") => api<Visit>(`/v1/visits/${encodeURIComponent(visitId)}/status`, json("PATCH", { status })),
  recordVitals: (visitId: string, values: Partial<Omit<Vitals, "id" | "visit_id" | "patient_id" | "recorded_by" | "recorded_at">>) => api<Vitals>(`/v1/visits/${encodeURIComponent(visitId)}/vitals`, json("POST", values)),
  getVitals: (patientId: string) => api<Vitals[]>(`/v1/patients/${encodeURIComponent(patientId)}/vitals`),
  getPatientFullRecord: (patientId: string, limit = 20) => api<PatientFullRecord>(`/v1/patients/${encodeURIComponent(patientId)}/full-record?limit=${limit}`),
  getTimeline: (patientId: string) => api<TimelineItem[]>(`/v1/patients/${encodeURIComponent(patientId)}/timeline`),
  getDoctorAppointments: () => api<Appointment[]>("/v1/doctor/appointments"),
  getAiDiagnosisSuggestion: (patientId: string, symptoms: string) => api<AiDiagnosisSuggestion>(`/v1/patients/${encodeURIComponent(patientId)}/ai-diagnosis-suggestion`, json("POST", { symptoms })),
  createEncounter: (visitId: string, values: Pick<Encounter, "symptoms" | "assessment" | "diagnosis">) => api<Encounter>(`/v1/visits/${encodeURIComponent(visitId)}/encounters`, json("POST", values)),
  updateEncounter: (encounterId: string, values: Partial<Pick<Encounter, "symptoms" | "assessment" | "diagnosis" | "notes">>) => api<Encounter>(`/v1/encounters/${encodeURIComponent(encounterId)}`, json("PATCH", values)),
  finalizeEncounter: (encounterId: string) => api<Encounter>(`/v1/encounters/${encodeURIComponent(encounterId)}/finalize`, json("PATCH")),
  amendEncounter: (encounterId: string, values: Partial<Pick<Encounter, "symptoms" | "assessment" | "diagnosis" | "notes">>) => api<Encounter>(`/v1/encounters/${encodeURIComponent(encounterId)}/amend`, json("POST", values)),
  createPrescription: (encounterId: string, values: Omit<Prescription, "id" | "encounter_id" | "patient_id" | "doctor_id" | "status" | "issued_at" | "forwarded_to_facility_id" | "forward_status" | "amount" | "payment_status" | "paid_at">) => api<Prescription>(`/v1/encounters/${encodeURIComponent(encounterId)}/prescriptions`, json("POST", values)),
  forwardPrescription: (prescriptionId: string, pharmacyFacilityId: string) => api<Prescription>(`/v1/prescriptions/${encodeURIComponent(prescriptionId)}/forward`, json("POST", { pharmacy_facility_id: pharmacyFacilityId })),
  setPrescriptionPayment: (prescriptionId: string, payload: PaymentUpdate) => api<FacilityPrescription>(`/v1/prescriptions/${encodeURIComponent(prescriptionId)}/payment`, json("PATCH", payload)),
  searchLabCatalog: async (query: string) => {
    const result = await api<{ items: LabCatalogItem[] }>(`/v1/catalog/labs?query=${encodeURIComponent(query)}`);
    return result.items;
  },
  createLabRequest: (encounterId: string, testName: string, notes: string) => api<LabRequest>(`/v1/encounters/${encodeURIComponent(encounterId)}/lab-requests`, json("POST", { test_name: testName, notes })),
  forwardLabRequest: (labRequestId: string, labFacilityId: string) => api<LabRequest>(`/v1/lab-requests/${encodeURIComponent(labRequestId)}/forward`, json("POST", { lab_facility_id: labFacilityId })),
  listFacilityLabRequests: (_facilityId: string, page: number, filters: LabRequestFilters = {}) => {
    const query = new URLSearchParams({ page: String(page), per_page: String(filters.perPage || 20) });
    if (filters.status) query.set("status", filters.status);
    if (filters.paymentStatus) query.set("payment_status", filters.paymentStatus);
    if (filters.search?.trim()) query.set("search", filters.search.trim());
    if (filters.orderedFrom) query.set("ordered_from", filters.orderedFrom);
    if (filters.orderedTo) query.set("ordered_to", filters.orderedTo);
    return api<Paginated<LabRequest>>(`/v1/facility/lab-requests?${query}`);
  },
  setLabRequestPayment: (labRequestId: string, payload: PaymentUpdate) => api<LabRequest>(`/v1/lab-requests/${encodeURIComponent(labRequestId)}/payment`, json("PATCH", payload)),
  submitLabResult: (labRequestId: string, payload: LabResultPayload) => api<LabRequest>(`/v1/lab-requests/${encodeURIComponent(labRequestId)}/result`, json("POST", payload)),
  uploadFile: (file: File, folder = "lab-results") => {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    return api<UploadedFile>("/v1/uploads", { method: "POST", body });
  },
  listFacilityPrescriptions: (facilityId: string, page: number, filters: PrescriptionFilters = {}) => {
    const query = prescriptionFiltersQuery(page, filters);
    return api<Paginated<FacilityPrescription>>(`/v1/facilities/${encodeURIComponent(facilityId)}/prescriptions?${query}`);
  },
  dispensePrescription: (prescriptionId: string) => api<FacilityPrescription>(`/v1/prescriptions/${encodeURIComponent(prescriptionId)}/dispense`, json("PATCH")),
  directory: (type: "pharmacy" | "lab") => api<Facility[]>(`/v1/facilities/directory?type=${type}`),
  listFinancePrescriptions: (page: number, filters: PrescriptionFilters = {}) => api<Paginated<FacilityPrescription>>(`/v1/facility/prescriptions?${prescriptionFiltersQuery(page, filters)}`),
  listFinanceLabRequests: (page: number, perPage = 20) => api<Paginated<LabRequest>>(`/v1/facility/lab-requests?page=${page}&per_page=${perPage}`),
  getFinanceStats: (filters: { from?: string; to?: string; paymentStatus?: PaymentStatus }) => {
    const query = new URLSearchParams();
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (filters.paymentStatus) query.set("payment_status", filters.paymentStatus);
    const search = query.toString();
    return api<FinanceStats>(`/v1/facility/finance/stats${search ? `?${search}` : ""}`);
  },
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

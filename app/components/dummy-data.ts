import type { IconName } from "./icons";

export const navItems: { label: string; icon: IconName }[] = [
  { label: "Overview", icon: "grid" }, { label: "AI Assistant", icon: "sparkles" }, { label: "Appointments", icon: "calendar" }, { label: "Patients", icon: "users" }, { label: "Messages", icon: "message" }, { label: "My schedule", icon: "clock" }, { label: "Prescriptions", icon: "file" }, { label: "Earnings", icon: "wallet" },
];
export const appointments = [
  { time: "09:00", end: "09:30", initials: "AA", name: "Amara Adeyemi", detail: "Follow-up consultation", type: "Video visit", tone: "blue", status: "Completed" },
  { time: "10:30", end: "11:00", initials: "TO", name: "Tunde Ojo", detail: "Hypertension review", type: "Video visit", tone: "green", status: "Next" },
  { time: "11:30", end: "12:00", initials: "IN", name: "Ifeoma Nwosu", detail: "New patient consultation", type: "Clinic visit", tone: "purple", status: "Confirmed" },
  { time: "14:00", end: "14:30", initials: "MO", name: "Musa Okafor", detail: "Lab results review", type: "Video visit", tone: "orange", status: "Confirmed" },
];
export const messages = [
  { initials: "AA", name: "Amara Adeyemi", text: "Thank you, doctor. I’ll start the new dose today.", time: "8 min", tone: "blue", unread: true },
  { initials: "TO", name: "Tunde Ojo", text: "I’ve uploaded my blood pressure readings.", time: "34 min", tone: "green", unread: true },
  { initials: "CN", name: "Care team", text: "Referral for Adaeze has been confirmed.", time: "1 hr", tone: "purple", unread: false },
];
export const patients = [
  { id: "MT-1042", initials: "AA", name: "Amara Adeyemi", age: 34, sex: "Female", phone: "0803 421 8850", condition: "Type 2 diabetes", lastVisit: "Today", status: "Active", tone: "blue" },
  { id: "MT-0988", initials: "TO", name: "Tunde Ojo", age: 52, sex: "Male", phone: "0805 772 4912", condition: "Hypertension", lastVisit: "30 Jul", status: "Active", tone: "green" },
  { id: "MT-0914", initials: "IN", name: "Ifeoma Nwosu", age: 28, sex: "Female", phone: "0702 116 4430", condition: "New patient", lastVisit: "28 Jul", status: "New", tone: "purple" },
  { id: "MT-0871", initials: "MO", name: "Musa Okafor", age: 61, sex: "Male", phone: "0814 622 0531", condition: "High cholesterol", lastVisit: "24 Jul", status: "Active", tone: "orange" },
  { id: "MT-0795", initials: "CN", name: "Chioma Nnamdi", age: 42, sex: "Female", phone: "0901 774 2910", condition: "Asthma", lastVisit: "18 Jul", status: "Review", tone: "blue" },
];
export const prescriptions = [
  { patient: "Tunde Ojo", medication: "Amlodipine 5 mg", dosage: "Once daily", date: "30 Jul 2026", status: "Active" }, { patient: "Amara Adeyemi", medication: "Metformin 500 mg", dosage: "Twice daily", date: "30 Jul 2026", status: "Active" }, { patient: "Musa Okafor", medication: "Atorvastatin 20 mg", dosage: "Every night", date: "24 Jul 2026", status: "Active" }, { patient: "Chioma Nnamdi", medication: "Salbutamol inhaler", dosage: "As needed", date: "18 Jul 2026", status: "Review" },
];
export type Patient = (typeof patients)[number];
export type Appointment = (typeof appointments)[number];
export type Prescription = (typeof prescriptions)[number];

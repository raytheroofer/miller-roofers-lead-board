type ConfirmedAppointment = {
  status: string;
  roofrCalendarId: string | null;
  startsAt: Date;
  endsAt: Date | null;
};

export function isCurrentConfirmedAppointment(appointment: ConfirmedAppointment, now = new Date()) {
  return appointment.status === "set" && Boolean(appointment.roofrCalendarId?.trim()) &&
    (appointment.startsAt >= now || Boolean(appointment.endsAt && appointment.endsAt > now));
}

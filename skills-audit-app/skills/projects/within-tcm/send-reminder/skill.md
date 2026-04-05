# send-reminder

## Description
Send an appointment reminder email to a patient about their upcoming visit at WITHiN TCM.

## Trigger
TRIGGER when: user asks to send a reminder email to a patient about an appointment

## References
- Email template in index.html (reminder tab)
- Office addresses: Flatiron (151 W 19th St) and Midtown (30 E 60th St)

## Steps
1. Get the patient name and email
2. Get the appointment date/time
3. Select the office location
4. Generate the email using the reminder template
5. Open in Apple Mail via mailto link

## Notes
Patient should receive reminder 24-48 hours before appointment.

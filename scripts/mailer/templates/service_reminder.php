<?php
/**
 * SR Enterprises - Upcoming Service Reminder Email Template
 * 
 * Clean, corporate branded email template following official SR Enterprises design specifications.
 */

$customerDisplayName = !empty($toName) ? $toName : (!empty($customerName) ? $customerName : 'Valued Customer');
$formattedDate = !empty($scheduledDate) ? date('d M Y', strtotime($scheduledDate)) : date('d M Y', strtotime('+1 day'));
$cleanServiceNo = !empty($serviceNumber) ? htmlspecialchars($serviceNumber) : 'SRV-XXXX';
$cleanServiceType = ucwords(str_replace('_', ' ', $serviceType ?? 'Periodic Maintenance Visit'));

$subject = "Service Reminder: Scheduled for {$formattedDate} — {$companyName}";

// Plain Text fallback
$plainText = "Hello {$customerDisplayName},

This is a friendly reminder that your service visit is scheduled for {$formattedDate} with {$companyName}.

SERVICE DETAILS
--------------------------------------------------
Service Request ID: {$cleanServiceNo}
Service Type: {$cleanServiceType}
Scheduled Date: {$formattedDate}
" . (!empty($timeSlot) ? "Time Slot: " . htmlspecialchars($timeSlot) . "\n" : "") . "
" . (!empty($technicianName) ? "Assigned Technician: " . htmlspecialchars($technicianName) . "\n" : "") . "
" . (!empty($serviceAddress) ? "Service Address: " . htmlspecialchars($serviceAddress) . "\n" : "") . "
--------------------------------------------------

Need to reschedule or have questions?
Helpline: {$supportPhone}
Email: {$supportEmail}
{$companyName} — Reliable Solutions. Professional Service.
";
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?php echo htmlspecialchars($subject); ?></title>
    <style type="text/css">
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; color: #1e293b; }
        @media only screen and (max-width: 620px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .content-padding { padding: 16px !important; }
            .col-stack { display: block !important; width: 100% !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; color: #1e293b;">
    <center>
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto;" class="email-container">
            <!-- HEADER -->
            <tr>
                <td style="background-color: #061A3A; border-radius: 8px 8px 0 0; padding: 22px 24px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td valign="middle">
                                <table border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="width: 40px; height: 40px; background-color: #0B63F6; border-radius: 8px; text-align: center; vertical-align: middle; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: bold; color: #FFFFFF;">
                                            CRM
                                        </td>
                                        <td style="padding-left: 12px; vertical-align: middle;">
                                            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 17px; font-weight: bold; color: #FFFFFF; letter-spacing: 0.5px; line-height: 1.2;">
                                                <?php echo htmlspecialchars($companyName); ?>
                                            </div>
                                            <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #93C5FD; margin-top: 2px;">
                                                Reliable Solutions. Professional Service.
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td align="right" valign="middle">
                                <span style="display: inline-block; background-color: #0B63F6; border-radius: 4px; padding: 4px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #FFFFFF;">
                                    SERVICE REMINDER
                                </span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- MAIN CONTENT AREA -->
            <tr>
                <td style="background-color: #FFFFFF; padding: 28px 24px; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0;" class="content-padding">
                    <!-- Title & Greeting -->
                    <div style="font-size: 20px; font-weight: bold; color: #0F172A; margin-bottom: 4px;">
                        Upcoming Service Visit
                    </div>
                    <div style="font-size: 15px; font-weight: bold; color: #334155; margin-bottom: 6px;">
                        Hello <?php echo htmlspecialchars($customerDisplayName); ?>,
                    </div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
                        This is a friendly reminder that your doorstep RO water purifier service is scheduled for <strong><?php echo htmlspecialchars($formattedDate); ?></strong>.
                    </div>

                    <!-- MAIN STATUS CARD: SERVICE SCHEDULE (BLUE THEME) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #EAF3FF; border: 1px solid #0B63F6; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 11px; font-weight: bold; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.5px;">
                                                📅 SCHEDULED VISIT
                                            </div>
                                            <div style="font-size: 18px; font-weight: bold; color: #0B63F6; margin-top: 4px;">
                                                <?php echo htmlspecialchars($formattedDate); ?>
                                            </div>
                                        </td>
                                        <td align="right" valign="top">
                                            <span style="font-family: monospace; font-size: 12px; font-weight: bold; background-color: #FFFFFF; border: 1px solid #93C5FD; color: #1D4ED8; padding: 3px 8px; border-radius: 4px;">
                                                <?php echo $cleanServiceNo; ?>
                                            </span>
                                        </td>
                                    </tr>
                                </table>

                                <div style="height: 1px; background-color: #BFDBFE; margin: 12px 0;"></div>

                                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #1E293B;">
                                    <tr>
                                        <td style="padding: 3px 0; color: #1E40AF; width: 35%;">Service Type:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo htmlspecialchars($cleanServiceType); ?></td>
                                    </tr>
                                    <?php if (!empty($timeSlot)): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #1E40AF;">Time Slot:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo htmlspecialchars($timeSlot); ?></td>
                                    </tr>
                                    <?php endif; ?>
                                    <?php if (!empty($technicianName)): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #1E40AF;">Technician:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo htmlspecialchars($technicianName); ?></td>
                                    </tr>
                                    <?php endif; ?>
                                    <?php if (!empty($serviceAddress)): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #1E40AF; vertical-align: top;">Service Address:</td>
                                        <td style="padding: 3px 0;"><?php echo htmlspecialchars($serviceAddress); ?></td>
                                    </tr>
                                    <?php endif; ?>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- CARE TIP -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 14px 16px;">
                                <div style="font-size: 12px; font-weight: bold; color: #0F172A; margin-bottom: 4px;">
                                    💡 Need to reschedule?
                                </div>
                                <div style="font-size: 12px; color: #475569; line-height: 1.5;">
                                    If this date/time does not suit you, simply call our support helpline at <strong><?php echo htmlspecialchars($supportPhone); ?></strong> to adjust your appointment.
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- FOOTER -->
            <tr>
                <td style="background-color: #061A3A; border-radius: 0 0 8px 8px; padding: 22px 24px; color: #94A3B8; font-size: 11px; line-height: 1.6;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <div style="font-size: 12px; font-weight: bold; color: #FFFFFF; margin-bottom: 4px;">
                                    Need Assistance?
                                </div>
                                <div>Helpline: <strong style="color: #E2E8F0;"><?php echo htmlspecialchars($supportPhone); ?></strong></div>
                                <div>Email: <strong style="color: #E2E8F0;"><?php echo htmlspecialchars($supportEmail); ?></strong></div>
                                <div>Address: <span style="color: #CBD5E1;"><?php echo htmlspecialchars($companyName); ?> — Commercial Services</span></div>
                                <div style="margin-top: 8px; color: #64748B;">
                                    <?php echo htmlspecialchars($companyName); ?> • Reliable Solutions. Professional Service.
                                </div>
                            </td>
                            <td align="right" valign="bottom" style="text-align: right; color: #64748B; font-size: 10px;">
                                © <?php echo date('Y'); ?> <?php echo htmlspecialchars($companyName); ?>.<br />All rights reserved.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </center>
</body>
</html>

<?php
/**
 * SR Enterprises - Warranty Expiry Reminder Email Template
 * 
 * Clean, corporate branded email template following official SR Enterprises design specifications.
 */

$customerDisplayName = !empty($toName) ? $toName : (!empty($customerName) ? $customerName : 'Valued Customer');
$daysRemaining = (int)($daysRemaining ?? 30);
$formattedStartDate = !empty($startDate) ? date('d M Y', strtotime($startDate)) : 'N/A';
$formattedEndDate = !empty($endDate) ? date('d M Y', strtotime($endDate)) : date('d M Y');
$cleanModel = !empty($machineModel) ? htmlspecialchars($machineModel) : 'RO Water Purifier System';

$subject = "Warranty Expiry Reminder: " . ($daysRemaining <= 7 ? "URGENT — " : "") . "{$daysRemaining} Days Remaining for {$cleanModel} — {$companyName}";

// Plain Text fallback
$plainText = "Hello {$customerDisplayName},

Your water purifier product warranty is approaching its expiry on {$formattedEndDate} ({$daysRemaining} days remaining).

WARRANTY DETAILS
--------------------------------------------------
Product Model: {$cleanModel}
" . (!empty($serialNumber) ? "Serial Number: " . htmlspecialchars($serialNumber) . "\n" : "") . "
" . (!empty($warrantyNumber) ? "Warranty Certificate #: " . htmlspecialchars($warrantyNumber) . "\n" : "") . "
Warranty Expiry Date: {$formattedEndDate}
Days Remaining: {$daysRemaining} Days
--------------------------------------------------

Renew with Annual Maintenance Contract (AMC):
• Free doorstep repair visits
• Genuine spare parts and component replacements included
• Periodic automated service maintenance

Need Assistance?
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
                                <span style="display: inline-block; background-color: #EA580C; border-radius: 4px; padding: 4px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #FFFFFF;">
                                    WARRANTY NOTICE
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
                        Warranty Expiry Notice
                    </div>
                    <div style="font-size: 15px; font-weight: bold; color: #334155; margin-bottom: 6px;">
                        Hello <?php echo htmlspecialchars($customerDisplayName); ?>,
                    </div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
                        Your water purifier product warranty is approaching its expiry on <strong><?php echo htmlspecialchars($formattedEndDate); ?></strong> (<?php echo $daysRemaining; ?> days remaining).
                    </div>

                    <!-- MAIN STATUS CARD: WARRANTY DETAILS (ORANGE ALERT THEME) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFF7ED; border: 1px solid #EA580C; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 11px; font-weight: bold; color: #9A3412; text-transform: uppercase; letter-spacing: 0.5px;">
                                                🛡️ EXPIRING SOON
                                            </div>
                                            <div style="font-size: 20px; font-weight: bold; color: #EA580C; margin-top: 4px;">
                                                <?php echo $daysRemaining; ?> Days Remaining
                                            </div>
                                        </td>
                                        <td align="right" valign="top">
                                            <div style="font-size: 11px; color: #9A3412; font-weight: bold;">Expiry Date:</div>
                                            <div style="font-size: 13px; font-weight: bold; color: #C2410C; margin-top: 2px;">
                                                <?php echo htmlspecialchars($formattedEndDate); ?>
                                            </div>
                                        </td>
                                    </tr>
                                </table>

                                <div style="height: 1px; background-color: #FED7AA; margin: 12px 0;"></div>

                                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #1E293B;">
                                    <tr>
                                        <td style="padding: 3px 0; color: #9A3412; width: 35%;">Product Model:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo $cleanModel; ?></td>
                                    </tr>
                                    <?php if (!empty($serialNumber)): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #9A3412;">Serial Number:</td>
                                        <td style="padding: 3px 0; font-family: monospace;"><?php echo htmlspecialchars($serialNumber); ?></td>
                                    </tr>
                                    <?php endif; ?>
                                    <?php if (!empty($warrantyNumber)): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #9A3412;">Warranty Certificate:</td>
                                        <td style="padding: 3px 0; font-family: monospace;"><?php echo htmlspecialchars($warrantyNumber); ?></td>
                                    </tr>
                                    <?php endif; ?>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- AMC PROTECTION SECTION -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #EAF3FF; border: 1px solid #BFDBFE; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <div style="font-size: 12px; font-weight: bold; color: #1E40AF; margin-bottom: 6px;">
                                    💧 Protect Your Machine with AMC (Annual Maintenance Contract)
                                </div>
                                <div style="font-size: 12px; color: #1E3A8A; line-height: 1.6;">
                                    • <strong>Zero Breakdown Stress:</strong> 100% free doorstep repair visits.<br />
                                    • <strong>Free Filter Replacements:</strong> Genuine sediment, carbon &amp; RO membrane changes included.<br />
                                    • <strong>Scheduled Periodic Service:</strong> Automated visits every 3-4 months.
                                </div>
                                <div style="margin-top: 10px; font-size: 12px; font-weight: bold; color: #0B63F6;">
                                    Call our AMC Specialist at <?php echo htmlspecialchars($supportPhone); ?> to renew!
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

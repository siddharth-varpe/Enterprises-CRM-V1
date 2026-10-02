<?php
/**
 * SR Enterprises - Service Completed Email Template
 * 
 * Clean, corporate branded email template following official SR Enterprises design specifications.
 */

$customerDisplayName = !empty($toName) ? $toName : (!empty($customerName) ? $customerName : 'Valued Customer');
$formattedServiceDate = !empty($serviceDate) ? date('d M Y', strtotime($serviceDate)) : date('d M Y');
$formattedCompletedDate = !empty($completedDate) ? date('d M Y', strtotime($completedDate)) : date('d M Y');
$cleanServiceNo = !empty($serviceNumber) ? htmlspecialchars($serviceNumber) : 'SRV-XXXX';
$cleanServiceType = ucwords(str_replace('_', ' ', $serviceType ?? 'General Maintenance'));
$cleanTechnician = !empty($technicianName) ? htmlspecialchars($technicianName) : 'Certified SR Technician';
$cleanSummary = !empty($serviceDescription) ? htmlspecialchars($serviceDescription) : 'Your RO system has been thoroughly inspected, sanitized, cleaned and serviced for optimal drinking water purity.';
$serviceCost = (float)($amount ?? $serviceCost ?? 0);
$cleanPaymentStatus = !empty($paymentStatus) ? htmlspecialchars($paymentStatus) : ($serviceCost > 0 ? 'PAID' : 'COMPLIMENTARY / WARRANTY');

$subject = "Service Completed: #" . $cleanServiceNo . " — {$companyName}";

// Plain Text fallback
$plainText = "Hello {$customerDisplayName},

Service Completed!
Your RO service has been completed successfully by our certified service technician.

SERVICE DETAILS
--------------------------------------------------
Service Request ID: {$cleanServiceNo}
Service Type: {$cleanServiceType}
Service Date: {$formattedCompletedDate}
Technician: {$cleanTechnician}
Work Summary: {$cleanSummary}
" . ($serviceCost > 0 ? "Total Amount: ₹ " . number_format($serviceCost, 2) . "\nPayment Status: {$cleanPaymentStatus}\n" : "") . "
--------------------------------------------------

Care Tip:
Regular servicing ensures optimal performance and long life of your equipment.

Thank You!
We value your trust in our services. We look forward to serving you again.

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
                                <span style="display: inline-block; background-color: #16A34A; border-radius: 4px; padding: 4px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #FFFFFF;">
                                    SERVICE REPORT
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
                        Service Completed!
                    </div>
                    <div style="font-size: 15px; font-weight: bold; color: #334155; margin-bottom: 6px;">
                        Hello <?php echo htmlspecialchars($customerDisplayName); ?>,
                    </div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
                        Your RO service has been completed successfully. Your water purifier is running smoothly with optimal filtration efficiency.
                    </div>

                    <!-- MAIN STATUS CARD: SERVICE DETAILS (GREEN THEME) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #E7F7ED; border: 1px solid #16A34A; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ✓ SERVICE DETAILS
                                            </div>
                                            <div style="font-size: 17px; font-weight: bold; color: #15803D; margin-top: 4px;">
                                                <?php echo htmlspecialchars($cleanServiceType); ?>
                                            </div>
                                        </td>
                                        <td align="right" valign="top">
                                            <span style="font-family: monospace; font-size: 12px; font-weight: bold; background-color: #FFFFFF; border: 1px solid #86EFAC; color: #166534; padding: 3px 8px; border-radius: 4px;">
                                                <?php echo $cleanServiceNo; ?>
                                            </span>
                                        </td>
                                    </tr>
                                </table>

                                <div style="height: 1px; background-color: #86EFAC; margin: 12px 0;"></div>

                                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #1E293B;">
                                    <tr>
                                        <td style="padding: 3px 0; color: #166534; width: 35%;">Service Date:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo htmlspecialchars($formattedCompletedDate); ?></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 3px 0; color: #166534;">Technician:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo $cleanTechnician; ?></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 3px 0; color: #166534; vertical-align: top;">Work Summary:</td>
                                        <td style="padding: 3px 0; font-size: 12px; line-height: 1.4;"><?php echo $cleanSummary; ?></td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- INVOICE & PAYMENT SUMMARY (IF APPLICABLE) -->
                    <?php if ($serviceCost > 0): ?>
                    <div style="font-size: 12px; font-weight: bold; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        Service Billing Summary
                    </div>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; font-size: 12px;">
                        <tr style="background-color: #F8FAFC;">
                            <td style="padding: 9px 14px; color: #64748B; border-bottom: 1px solid #E2E8F0; width: 50%;">Total Amount:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #0F172A; border-bottom: 1px solid #E2E8F0;">₹ <?php echo number_format($serviceCost, 2); ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 9px 14px; color: #64748B;">Payment Status:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #15803D;"><?php echo $cleanPaymentStatus; ?></td>
                        </tr>
                    </table>
                    <?php endif; ?>

                    <!-- WATER QUALITY METRIC (IF AVAILABLE) -->
                    <?php if (!empty($outputTds)): ?>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 12px 16px;">
                                <div style="font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
                                    Water Quality Measurement
                                </div>
                                <div style="font-size: 18px; font-weight: bold; color: #15803D; margin-top: 2px;">
                                    <?php echo htmlspecialchars($outputTds); ?> PPM <span style="font-size: 11px; font-weight: normal; color: #166534;">(Optimal Drinking Standard Restored)</span>
                                </div>
                            </td>
                        </tr>
                    </table>
                    <?php endif; ?>

                    <!-- CARE TIP (BLUE INFORMATIONAL CARD) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #EAF3FF; border: 1px solid #BFDBFE; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 14px 16px;">
                                <div style="font-size: 12px; font-weight: bold; color: #1E40AF; margin-bottom: 4px;">
                                    💡 Care Tip
                                </div>
                                <div style="font-size: 12px; color: #1E3A8A; line-height: 1.5;">
                                    Regular servicing ensures pure water and long life of your RO water purifier system. Clean external filters periodically for maximum water pressure.
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- THANK YOU CARD -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px; text-align: center;">
                                <div style="font-size: 14px; font-weight: bold; color: #0F172A; margin-bottom: 4px;">
                                    Thank You!
                                </div>
                                <div style="font-size: 12px; color: #475569; line-height: 1.5;">
                                    We value your trust in our services. We look forward to serving you again.
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

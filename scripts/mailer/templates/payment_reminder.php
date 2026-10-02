<?php
/**
 * SR Enterprises - Payment Due Reminder Email Template
 * 
 * Clean, corporate branded email template following official SR Enterprises design specifications.
 */

$customerDisplayName = !empty($toName) ? $toName : (!empty($customerName) ? $customerName : 'Valued Customer');
$formattedTotal = number_format((float)($totalAmount ?? 0), 2);
$formattedPaid = number_format((float)($paidAmount ?? 0), 2);
$formattedDue = number_format((float)($dueAmount ?? max(0, (float)($totalAmount ?? 0) - (float)($paidAmount ?? 0))), 2);
$formattedDueDate = !empty($dueDate) ? date('d M Y', strtotime($dueDate)) : date('d M Y', strtotime('+7 days'));
$formattedInvoiceDate = !empty($invoiceDate) ? date('d M Y', strtotime($invoiceDate)) : date('d M Y');
$cleanInvoiceNo = !empty($invoiceNumber) ? htmlspecialchars($invoiceNumber) : 'INV-XXXX';
$upiId = !empty($upiId) ? $upiId : 'enterprises.crm@upi';

$isOverdue = (!empty($dueDate) && strtotime($dueDate) < strtotime('today')) && ((float)($dueAmount ?? 0) > 0);

$subject = ($isOverdue ? '⚠️ Payment Overdue: Invoice #' : 'Payment Due Reminder: Invoice #') . $cleanInvoiceNo . " — {$companyName}";

// Plain Text fallback
$plainText = "Hello {$customerDisplayName},

This is a friendly reminder regarding your outstanding payment for Invoice #{$cleanInvoiceNo} with {$companyName}.

PAYMENT DUE
--------------------------------------------------
Total Due Amount: ₹ {$formattedDue}
Due Date: {$formattedDueDate}

INVOICE INFORMATION
--------------------------------------------------
Invoice Number: {$cleanInvoiceNo}
Invoice Date: {$formattedInvoiceDate}
Total Invoice Amount: ₹ {$formattedTotal}
Amount Already Paid: ₹ {$formattedPaid}
Outstanding Due Amount: ₹ {$formattedDue}

Why timely payment matters?
Timely payments help us serve you better and ensure uninterrupted service.

QUICK UPI PAYMENT
UPI ID: {$upiId}
Accepted: Google Pay, PhonePe, Paytm, BHIM, Bank Transfer

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
                                <span style="display: inline-block; background-color: <?php echo $isOverdue ? '#991B1B' : '#C2410C'; ?>; border-radius: 4px; padding: 4px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #FFFFFF;">
                                    <?php echo $isOverdue ? 'OVERDUE' : 'PAYMENT DUE'; ?>
                                </span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <!-- MAIN CONTENT AREA -->
            <tr>
                <td style="background-color: #FFFFFF; padding: 28px 24px; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0;" class="content-padding">
                    <!-- Greeting -->
                    <div style="font-size: 15px; font-weight: bold; color: #0F172A; margin-bottom: 8px;">
                        Hello <?php echo htmlspecialchars($customerDisplayName); ?>,
                    </div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
                        This is a friendly reminder regarding your outstanding payment for Invoice <strong>#<?php echo $cleanInvoiceNo; ?></strong> with <strong><?php echo htmlspecialchars($companyName); ?></strong>.
                    </div>

                    <!-- MAIN STATUS CARD: PAYMENT DUE (ORANGE ALERT THEME) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFF7ED; border: 1px solid #EA580C; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 11px; font-weight: bold; color: #9A3412; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ⚠️ PAYMENT DUE
                                            </div>
                                            <div style="font-size: 26px; font-weight: bold; color: #EA580C; margin-top: 4px;">
                                                ₹ <?php echo $formattedDue; ?>
                                            </div>
                                        </td>
                                        <td align="right" valign="top">
                                            <div style="font-size: 11px; color: #9A3412; font-weight: bold;">Due Date:</div>
                                            <div style="font-size: 13px; font-weight: bold; color: #C2410C; margin-top: 2px;">
                                                <?php echo htmlspecialchars($formattedDueDate); ?>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- INVOICE INFORMATION TABLE -->
                    <div style="font-size: 12px; font-weight: bold; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        Invoice Details
                    </div>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; font-size: 12px;">
                        <tr style="background-color: #F8FAFC;">
                            <td style="padding: 9px 14px; color: #64748B; border-bottom: 1px solid #E2E8F0; width: 45%;">Invoice Number:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #0F172A; font-family: monospace; border-bottom: 1px solid #E2E8F0;"><?php echo $cleanInvoiceNo; ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 9px 14px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Invoice Date:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #0F172A; border-bottom: 1px solid #F1F5F9;"><?php echo htmlspecialchars($formattedInvoiceDate); ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 9px 14px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Total Invoice Amount:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #0F172A; border-bottom: 1px solid #F1F5F9;">₹ <?php echo $formattedTotal; ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 9px 14px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Amount Already Paid:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #15803D; border-bottom: 1px solid #F1F5F9;">₹ <?php echo $formattedPaid; ?></td>
                        </tr>
                        <tr style="background-color: #FFF7ED;">
                            <td style="padding: 9px 14px; font-weight: bold; color: #9A3412;">Total Outstanding Due:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #EA580C; font-size: 14px;">₹ <?php echo $formattedDue; ?></td>
                        </tr>
                    </table>

                    <!-- INFORMATIONAL MESSAGE CARD -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #EAF3FF; border: 1px solid #BFDBFE; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 14px 16px;">
                                <div style="font-size: 12px; font-weight: bold; color: #1E40AF; margin-bottom: 4px;">
                                    💡 Why timely payment matters?
                                </div>
                                <div style="font-size: 12px; color: #1E3A8A; line-height: 1.5;">
                                    Timely payments help us serve you better and ensure uninterrupted care for your RO water purifier system.
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- QUICK UPI & PAYMENT OPTIONS -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <div style="font-size: 12px; font-weight: bold; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                                    Quick &amp; Secure Payment
                                </div>
                                <div style="font-size: 12px; color: #475569; line-height: 1.6;">
                                    • <strong>Official UPI ID:</strong> <span style="font-family: monospace; font-weight: bold; background-color: #FFFFFF; border: 1px solid #CBD5E1; padding: 2px 8px; border-radius: 4px; color: #0F172A;"><?php echo htmlspecialchars($upiId); ?></span><br />
                                    • <strong>Supported Modes:</strong> Google Pay, PhonePe, Paytm, BHIM UPI, Net Banking, or Doorstep Cash.<br />
                                    • <strong>Helpline Support:</strong> <?php echo htmlspecialchars($supportPhone); ?>
                                </div>

                                <?php if (!empty($invoiceUrl)): ?>
                                <div style="margin-top: 14px; text-align: center;">
                                    <a href="<?php echo htmlspecialchars($invoiceUrl); ?>" target="_blank" style="display: inline-block; background-color: #0B63F6; color: #FFFFFF; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 6px;">
                                        View Invoice &amp; Pay Now →
                                    </a>
                                </div>
                                <?php endif; ?>
                            </td>
                        </tr>
                    </table>

                    <div style="font-size: 11px; color: #64748B; line-height: 1.5;">
                        Note: If you have already made this payment recently, thank you! Please ignore this reminder or reply with your payment reference for instant account update.
                    </div>
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

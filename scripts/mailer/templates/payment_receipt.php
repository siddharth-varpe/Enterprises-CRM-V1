<?php
/**
 * SR Enterprises - Payment Received Email Template
 * 
 * Clean, corporate branded email template following official SR Enterprises design specifications.
 * Dynamically displays due date and balance notices for partial payment receipts.
 */

$customerDisplayName = !empty($customerName) ? $customerName : (!empty($toName) ? $toName : 'Valued Customer');
$formattedTotal = number_format((float)($totalAmount ?? 0), 2);
$formattedPaid = number_format((float)($amount ?? 0), 2);
$formattedPrevPaid = number_format((float)($previousPaidAmount ?? 0), 2);
$formattedPrevOutstanding = number_format((float)($previousOutstanding ?? max(0, (float)($totalAmount ?? 0) - (float)($previousPaidAmount ?? 0))), 2);
$formattedTotalPaid = number_format((float)($totalPaidAmount ?? ((float)($previousPaidAmount ?? 0) + (float)($amount ?? 0))), 2);
$formattedRemaining = number_format((float)($remainingBalance ?? 0), 2);
$formattedPaymentDate = !empty($paymentDate) ? date('d M Y', strtotime($paymentDate)) : date('d M Y');
$cleanPaymentMethod = !empty($paymentMethod) ? htmlspecialchars($paymentMethod) : 'UPI / Bank Transfer';
$cleanTxnId = !empty($transactionId) ? htmlspecialchars($transactionId) : (!empty($referenceId) ? htmlspecialchars($referenceId) : 'N/A');
$cleanInvoiceNo = !empty($invoiceNumber) ? htmlspecialchars($invoiceNumber) : 'INV-XXXX';

$rawStatus = strtoupper($paymentStatus ?? ((float)($remainingBalance ?? 0) <= 0.01 ? 'PAID' : 'PARTIALLY PAID'));
$isFullyPaid = ($rawStatus === 'PAID' || (float)($remainingBalance ?? 0) <= 0.01);
$displayStatus = $isFullyPaid ? 'Fully Paid' : 'Partially Paid';

// Next Due Date resolution for partial payments
$rawDueDate = !empty($nextDueDate) ? $nextDueDate : (!empty($dueDate) ? $dueDate : (!empty($invoiceDueDate) ? $invoiceDueDate : null));
$formattedDueDate = !empty($rawDueDate) ? date('d M Y', strtotime($rawDueDate)) : date('d M Y', strtotime('+15 days'));

$subject = "Payment Receipt & Invoice — " . $cleanInvoiceNo . " — {$companyName}";

// Plain Text fallback
$plainText = "Hello {$customerDisplayName},

Thank you for your payment. We truly appreciate your trust in {$companyName}.

PAYMENT RECEIVED
--------------------------------------------------
Payment Status: {$displayStatus}
Payment Date: {$formattedPaymentDate}
Invoice Number: {$cleanInvoiceNo}
Amount Paid: ₹ {$formattedPaid}
Payment Method: {$cleanPaymentMethod}
Transaction ID: {$cleanTxnId}
" . (!$isFullyPaid ? "Next Due Date: {$formattedDueDate}\n" : "") . "
INVOICE SUMMARY
--------------------------------------------------
Invoice Amount: ₹ {$formattedTotal}
Total Paid: ₹ {$formattedTotalPaid}
" . ($isFullyPaid ? "Outstanding Balance: ₹ 0.00" : "Remaining Balance: ₹ {$formattedRemaining}\nNext Payment Due Date: {$formattedDueDate}") . "
Payment Status: {$displayStatus}

Your official bill/receipt is attached to this email as a PDF.

Services Offered: Professional Repair Services | Equipment Sales | Spare Parts | AMC

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
                                <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 4px; padding: 4px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #E0E7FF;">
                                    <?php echo $isFullyPaid ? 'TAX INVOICE' : 'PART RECEIPT'; ?>
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
                        Thank you for your payment. We truly appreciate your trust in <strong><?php echo htmlspecialchars($companyName); ?></strong>. Your payment details have been recorded below.
                    </div>

                    <!-- MAIN STATUS CARD: PAYMENT RECEIVED (GREEN THEME) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #E7F7ED; border: 1px solid #16A34A; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ✓ PAYMENT RECEIVED
                                            </div>
                                            <div style="font-size: 26px; font-weight: bold; color: #15803D; margin-top: 4px;">
                                                ₹ <?php echo $formattedPaid; ?>
                                            </div>
                                        </td>
                                        <td align="right" valign="top">
                                            <span style="display: inline-block; background-color: <?php echo $isFullyPaid ? '#16A34A' : '#EA580C'; ?>; color: #FFFFFF; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 12px;">
                                                <?php echo $displayStatus; ?>
                                            </span>
                                        </td>
                                    </tr>
                                </table>

                                <div style="height: 1px; background-color: #86EFAC; margin: 12px 0;"></div>

                                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #1E293B;">
                                    <tr>
                                        <td style="padding: 3px 0; color: #166534; width: 40%;">Payment Date:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo htmlspecialchars($formattedPaymentDate); ?></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 3px 0; color: #166534;">Invoice Number:</td>
                                        <td style="padding: 3px 0; font-weight: bold; font-family: monospace;"><?php echo $cleanInvoiceNo; ?></td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 3px 0; color: #166534;">Payment Method:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo $cleanPaymentMethod; ?></td>
                                    </tr>
                                    <?php if ($cleanTxnId !== 'N/A'): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #166534;">Transaction ID:</td>
                                        <td style="padding: 3px 0; font-family: monospace;"><?php echo $cleanTxnId; ?></td>
                                    </tr>
                                    <?php endif; ?>
                                    <?php if (!$isFullyPaid): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #9A3412; font-weight: bold;">Next Due Date:</td>
                                        <td style="padding: 3px 0; font-weight: bold; color: #C2410C;"><?php echo htmlspecialchars($formattedDueDate); ?></td>
                                    </tr>
                                    <?php endif; ?>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- INVOICE SUMMARY TABLE -->
                    <div style="font-size: 12px; font-weight: bold; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        Invoice Financial Summary
                    </div>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 20px; font-size: 12px;">
                        <tr style="background-color: #F8FAFC;">
                            <td style="padding: 9px 14px; color: #64748B; border-bottom: 1px solid #E2E8F0; width: 45%;">Total Invoice Amount:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #0F172A; border-bottom: 1px solid #E2E8F0;">₹ <?php echo $formattedTotal; ?></td>
                        </tr>
                        <tr>
                            <td style="padding: 9px 14px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Total Amount Paid to Date:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #15803D; border-bottom: 1px solid #F1F5F9;">₹ <?php echo $formattedTotalPaid; ?></td>
                        </tr>
                        <?php if ($isFullyPaid): ?>
                        <tr style="background-color: #F0FDF4;">
                            <td style="padding: 9px 14px; font-weight: bold; color: #166534;">Outstanding Balance:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #15803D;">₹ 0.00 (Fully Settled)</td>
                        </tr>
                        <?php else: ?>
                        <tr style="background-color: #FFF7ED;">
                            <td style="padding: 9px 14px; font-weight: bold; color: #C2410C; border-bottom: 1px solid #FDBA74;">Remaining Balance Due:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #EA580C; font-size: 14px; border-bottom: 1px solid #FDBA74;">₹ <?php echo $formattedRemaining; ?></td>
                        </tr>
                        <tr style="background-color: #FFFBEB;">
                            <td style="padding: 9px 14px; font-weight: bold; color: #92400E;">Next Payment Due Date:</td>
                            <td align="right" style="padding: 9px 14px; font-weight: bold; color: #B45309;"><?php echo htmlspecialchars($formattedDueDate); ?></td>
                        </tr>
                        <?php endif; ?>
                    </table>

                    <!-- PARTIAL PAYMENT DUE NOTICE (IF PARTIALLY PAID) -->
                    <?php if (!$isFullyPaid): ?>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFF7ED; border: 1px solid #FDBA74; border-left: 4px solid #EA580C; border-radius: 6px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 12px 16px; font-size: 12px; color: #9A3412; line-height: 1.5;">
                                ⚠️ <strong>Next Due Date Notice:</strong> Please clear the remaining balance of <strong>₹ <?php echo $formattedRemaining; ?></strong> on or before <strong><?php echo htmlspecialchars($formattedDueDate); ?></strong>. You will receive reminders as the due date approaches.
                            </td>
                        </tr>
                    </table>
                    <?php endif; ?>

                    <!-- ATTACHMENT NOTICE -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 12px 16px; font-size: 12px; color: #334155;">
                                📄 <strong>Official Document Attached:</strong> Your official bill / receipt is attached to this email as a PDF document for your records and warranty validation.
                            </td>
                        </tr>
                    </table>

                    <!-- SERVICES SECTION -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #EAF3FF; border: 1px solid #BFDBFE; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 14px 16px;">
                                <div style="font-size: 11px; font-weight: bold; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                                    <?php echo htmlspecialchars($companyName); ?> Comprehensive Services
                                </div>
                                <div style="font-size: 12px; color: #1E3A8A; line-height: 1.5;">
                                    • Equipment Repair Services &amp; Maintenance<br />
                                    • New Product Sales &amp; Installation<br />
                                    • Genuine Spare Parts &amp; Component Replacements<br />
                                    • Annual Maintenance Contracts (AMC)
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- CLOSING -->
                    <div style="font-size: 13px; color: #475569; line-height: 1.5;">
                        Thank you for choosing <strong><?php echo htmlspecialchars($companyName); ?></strong>. We look forward to providing you with uninterrupted service.
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

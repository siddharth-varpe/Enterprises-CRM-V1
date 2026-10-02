<?php
/**
 * SR Enterprises - Sale Order Confirmation Email Template
 * 
 * Clean, corporate branded email template following official SR Enterprises design specifications.
 */

$customerDisplayName = !empty($toName) ? $toName : (!empty($customerName) ? $customerName : 'Valued Customer');
$formattedTotal = number_format((float)($totalAmount ?? 0), 2);
$formattedSubtotal = number_format((float)($subtotal ?? $totalAmount), 2);
$formattedTax = number_format((float)($taxAmount ?? 0), 2);
$formattedDiscount = number_format((float)($discountAmount ?? 0), 2);
$formattedSaleDate = !empty($saleDate) ? date('d M Y', strtotime($saleDate)) : date('d M Y');
$cleanSaleNo = !empty($saleNumber) ? htmlspecialchars($saleNumber) : 'SALE-XXXX';
$cleanCustomerNo = !empty($customerNumber) ? htmlspecialchars($customerNumber) : '';

$itemsList = $items ?? [];
$itemRowsHtml = '';
foreach ($itemsList as $idx => $item) {
    $pName = htmlspecialchars($item['productNameSnapshot'] ?? $item['productName'] ?? 'RO Water Purifier');
    $pSku = htmlspecialchars($item['skuSnapshot'] ?? $item['sku'] ?? '');
    $qty = (int)($item['quantity'] ?? 1);
    $price = number_format((float)($item['unitPriceSnapshot'] ?? $item['unitPrice'] ?? 0), 2);
    $total = number_format((float)($item['lineTotal'] ?? ($qty * (float)($item['unitPriceSnapshot'] ?? $item['unitPrice'] ?? 0))), 2);
    
    $itemRowsHtml .= "
        <tr>
            <td style='padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; color: #1E293B;'>
                <strong>{$pName}</strong>" . ($pSku ? "<div style='font-size: 11px; color: #64748B; font-family: monospace;'>SKU: {$pSku}</div>" : '') . "
            </td>
            <td style='padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: center; color: #1E293B;'>{$qty}</td>
            <td style='padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right; color: #1E293B;'>₹ {$price}</td>
            <td style='padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right; color: #0F172A; font-weight: bold;'>₹ {$total}</td>
        </tr>
    ";
}

$subject = "Order Confirmation: Sale #{$cleanSaleNo} — {$companyName}";

// Plain Text fallback
$plainText = "Hello {$customerDisplayName},

Thank you for your order with {$companyName}! Your sale transaction has been confirmed and recorded.

ORDER DETAILS
--------------------------------------------------
Sale Order Number: {$cleanSaleNo}
Order Date: {$formattedSaleDate}
Total Amount: ₹ {$formattedTotal}

Your official GST invoice is attached to this email as a PDF document.

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
                                <span style="display: inline-block; background-color: #0B63F6; border-radius: 4px; padding: 4px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: bold; color: #FFFFFF;">
                                    SALE ORDER
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
                        Order Confirmed!
                    </div>
                    <div style="font-size: 15px; font-weight: bold; color: #334155; margin-bottom: 6px;">
                        Hello <?php echo htmlspecialchars($customerDisplayName); ?>,
                    </div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
                        Thank you for choosing <strong><?php echo htmlspecialchars($companyName); ?></strong>. Your sale order has been confirmed and successfully registered in our system.
                    </div>

                    <!-- MAIN STATUS CARD: SALE DETAILS (BLUE THEME) -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #EAF3FF; border: 1px solid #0B63F6; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 16px 18px;">
                                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 11px; font-weight: bold; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ✓ ORDER CONFIRMED
                                            </div>
                                            <div style="font-size: 24px; font-weight: bold; color: #0B63F6; margin-top: 4px;">
                                                ₹ <?php echo $formattedTotal; ?>
                                            </div>
                                        </td>
                                        <td align="right" valign="top">
                                            <span style="font-family: monospace; font-size: 12px; font-weight: bold; background-color: #FFFFFF; border: 1px solid #93C5FD; color: #1D4ED8; padding: 3px 8px; border-radius: 4px;">
                                                <?php echo $cleanSaleNo; ?>
                                            </span>
                                        </td>
                                    </tr>
                                </table>

                                <div style="height: 1px; background-color: #BFDBFE; margin: 12px 0;"></div>

                                <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12px; color: #1E293B;">
                                    <tr>
                                        <td style="padding: 3px 0; color: #1E40AF; width: 35%;">Order Date:</td>
                                        <td style="padding: 3px 0; font-weight: bold;"><?php echo htmlspecialchars($formattedSaleDate); ?></td>
                                    </tr>
                                    <?php if (!empty($invoiceNumber)): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #1E40AF;">Tax Invoice #:</td>
                                        <td style="padding: 3px 0; font-weight: bold; font-family: monospace;"><?php echo htmlspecialchars($invoiceNumber); ?></td>
                                    </tr>
                                    <?php endif; ?>
                                    <?php if (!empty($cleanCustomerNo)): ?>
                                    <tr>
                                        <td style="padding: 3px 0; color: #1E40AF;">Customer ID:</td>
                                        <td style="padding: 3px 0; font-family: monospace;"><?php echo $cleanCustomerNo; ?></td>
                                    </tr>
                                    <?php endif; ?>
                                </table>
                            </td>
                        </tr>
                    </table>

                    <!-- PURCHASED ITEMS TABLE -->
                    <?php if (!empty($itemRowsHtml)): ?>
                    <div style="font-size: 12px; font-weight: bold; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        Purchased Products &amp; Items
                    </div>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #F8FAFC;">
                                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: bold; color: #475569; border-bottom: 1px solid #E2E8F0;">Product Description</th>
                                <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: bold; color: #475569; border-bottom: 1px solid #E2E8F0; width: 45px;">Qty</th>
                                <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: bold; color: #475569; border-bottom: 1px solid #E2E8F0; width: 85px;">Price</th>
                                <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: bold; color: #475569; border-bottom: 1px solid #E2E8F0; width: 90px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php echo $itemRowsHtml; ?>
                        </tbody>
                    </table>
                    <?php endif; ?>

                    <!-- TOTALS BREAKDOWN -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 20px; font-size: 12px;">
                        <tr>
                            <td style="padding: 8px 14px; color: #64748B;">Subtotal:</td>
                            <td align="right" style="padding: 8px 14px; font-weight: bold; color: #0F172A;">₹ <?php echo $formattedSubtotal; ?></td>
                        </tr>
                        <?php if ((float)($taxAmount ?? 0) > 0): ?>
                        <tr>
                            <td style="padding: 8px 14px; color: #64748B;">GST / Tax:</td>
                            <td align="right" style="padding: 8px 14px; font-weight: bold; color: #0F172A;">₹ <?php echo $formattedTax; ?></td>
                        </tr>
                        <?php endif; ?>
                        <?php if ((float)($discountAmount ?? 0) > 0): ?>
                        <tr>
                            <td style="padding: 8px 14px; color: #16A34A;">Discount:</td>
                            <td align="right" style="padding: 8px 14px; font-weight: bold; color: #16A34A;">- ₹ <?php echo $formattedDiscount; ?></td>
                        </tr>
                        <?php endif; ?>
                        <tr style="background-color: #061A3A;">
                            <td style="padding: 10px 14px; font-size: 13px; font-weight: bold; color: #FFFFFF;">Grand Total:</td>
                            <td align="right" style="padding: 10px 14px; font-size: 15px; font-weight: bold; color: #60A5FA;">₹ <?php echo $formattedTotal; ?></td>
                        </tr>
                    </table>

                    <!-- ATTACHMENT NOTICE -->
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 12px 16px; font-size: 12px; color: #334155;">
                                📄 <strong>Official Tax Invoice Attached:</strong> Your official bill / tax invoice PDF is attached to this email for your warranty registration and accounts.
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

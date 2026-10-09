import type { FastifyPluginAsync } from 'fastify';
import { paymentsService } from './payments.service';
import {
  PaymentQueryFilterSchema,
  CreatePaymentSchema,
  CancelPaymentSchema,
  RefundPaymentSchema,
} from '@crm/validation';
import { requirePermission } from '../../middleware/rbac';
import { authenticate } from '../../middleware/auth';

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/v1/payments/kpis
   * Financial KPIs overview (Total Collected, Today Collected, Outstanding, Overdue count)
   */
  fastify.get('/kpis', { preHandler: [requirePermission('payments.view')] }, async (_request, reply) => {
    const kpis = await paymentsService.getKPIs();
    return reply.send({
      success: true,
      data: kpis,
    });
  });

  /**
   * GET /api/v1/payments
   * List paginated payments with filters & search
   */
  fastify.get('/', { preHandler: [requirePermission('payments.view')] }, async (request, reply) => {
    const query = PaymentQueryFilterSchema.parse(request.query);
    const result = await paymentsService.getPayments(query);
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });

  /**
   * GET /api/v1/payments/invoice/:invoiceId
   * Get all payments recorded for an invoice
   */
  fastify.get('/invoice/:invoiceId', { preHandler: [requirePermission('payments.view')] }, async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const items = await paymentsService.getPaymentsByInvoice(invoiceId);
    return reply.send({
      success: true,
      data: items,
    });
  });

  /**
   * GET /api/v1/payments/invoice/:invoiceId/balance
   * Authoritative invoice balance and receivables breakdown
   */
  fastify.get('/invoice/:invoiceId/balance', { preHandler: [requirePermission('payments.view')] }, async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const balance = await paymentsService.getInvoiceBalance(invoiceId);
    return reply.send({
      success: true,
      data: balance,
    });
  });

  /**
   * GET /api/v1/payments/customer/:customerId/summary
   * Authoritative customer financial ledger summary
   */
  fastify.get('/customer/:customerId/summary', { preHandler: [requirePermission('payments.view')] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const summary = await paymentsService.getCustomerFinancialSummary(customerId);
    return reply.send({
      success: true,
      data: summary,
    });
  });

  /**
   * GET /api/v1/payments/customer/:customerId
   * Get customer payments list
   */
  fastify.get('/customer/:customerId', { preHandler: [requirePermission('payments.view')] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const query = PaymentQueryFilterSchema.parse({ ...request.query as any, customerId });
    const result = await paymentsService.getPayments(query);
    return reply.send({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });

  /**
   * GET /api/v1/payments/:id
   * Get single payment detail
   */
  fastify.get('/:id', { preHandler: [requirePermission('payments.view')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payment = await paymentsService.getPaymentById(id);
    return reply.send({
      success: true,
      data: payment,
    });
  });

  /**
   * POST /api/v1/payments
   * Record a new customer payment with ACID transaction & row lock
   */
  fastify.post('/', { preHandler: [requirePermission('payments.create')] }, async (request, reply) => {
    const body = CreatePaymentSchema.parse(request.body);
    const actorId = request.user?.userId;
    const actorName = request.user?.username || 'Staff';

    const result = await paymentsService.recordPayment(body, actorId, actorName);
    return reply.status(201).send({
      success: true,
      data: result,
      message: 'Payment recorded successfully',
    });
  });

  /**
   * POST /api/v1/payments/:id/cancel
   * Cancel payment and recalculate invoice balance atomically
   */
  fastify.post('/:id/cancel', { preHandler: [requirePermission('payments.refund')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = CancelPaymentSchema.parse(request.body);
    const actorId = request.user?.userId;
    const actorName = request.user?.username || 'Staff';

    const result = await paymentsService.cancelPayment(id, body, actorId, actorName);
    return reply.send({
      success: true,
      data: result,
      message: 'Payment cancelled and invoice balance recalculated',
    });
  });

  /**
   * POST /api/v1/payments/:id/reverse
   * Reverse payment (alias for cancel) with permission check
   */
  fastify.post('/:id/reverse', { preHandler: [requirePermission('payments.refund')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = CancelPaymentSchema.parse(request.body);
    const actorId = request.user?.userId;
    const actorName = request.user?.username || 'Staff';

    const result = await paymentsService.cancelPayment(id, body, actorId, actorName);
    return reply.send({
      success: true,
      data: result,
      message: 'Payment reversed and invoice balance recalculated',
    });
  });

  /**
   * POST /api/v1/payments/:id/refund
   * Record payment refund
   */
  fastify.post('/:id/refund', { preHandler: [requirePermission('payments.refund')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = RefundPaymentSchema.parse(request.body);
    const actorId = request.user?.userId;
    const actorName = request.user?.username || 'Staff';

    const result = await paymentsService.refundPayment(id, body, actorId, actorName);
    return reply.send({
      success: true,
      data: result,
      message: 'Payment refund recorded',
    });
  });
};

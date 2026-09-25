import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanData() {
  console.log('🧹 Clearing test orders, payments, cart items, products, and test accounts...');

  // 1. Delete dependent transactional records
  await prisma.payment.deleteMany({});
  await prisma.refundAuditLog.deleteMany({});
  await prisma.adminNotification.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.review.deleteMany({});

  // 2. Delete test products & product images
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});

  // 3. Delete non-default test users & test vendors (keep primary seed users)
  const defaultEmails = ['admin@plantmarket.com', 'evergreen@nursery.com', 'john@customer.com'];
  
  // Find test vendors to delete
  const testVendors = await prisma.vendor.findMany({
    where: { user: { email: { notIn: defaultEmails } } },
  });
  for (const v of testVendors) {
    await prisma.vendor.delete({ where: { id: v.id } });
  }

  // Find test users to delete
  await prisma.user.deleteMany({
    where: { email: { notIn: defaultEmails } },
  });

  console.log('✅ Clean complete! All test items and orders have been removed.');
}

cleanData()
  .catch((e) => {
    console.error('❌ Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

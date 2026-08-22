import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Delete the incorrect "100ml" category if it exists
  try {
    const incorrectCategory = await prisma.productCategory.findFirst({
      where: { name: '100ml' },
    });
    if (incorrectCategory) {
      await prisma.productCategory.delete({
        where: { id: incorrectCategory.id },
      });
      console.log('Deleted incorrect "100ml" category.');
    }
  } catch (error) {
    console.error('Could not delete "100ml" category (it might not exist or has products linked):', error);
  }

  // 2. Define the new categories
  const categories = [
    { name: 'Facial Wash', slug: 'facial-wash', sortOrder: 1 },
    { name: 'Moisturizer', slug: 'moisturizer', sortOrder: 2 },
    { name: 'Sunscreen', slug: 'sunscreen', sortOrder: 3 },
    { name: 'Serum', slug: 'serum', sortOrder: 4 },
    { name: 'Toner', slug: 'toner', sortOrder: 5 },
  ];

  // 3. Upsert the categories
  for (const category of categories) {
    const upserted = await prisma.productCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    });
    console.log(`Upserted category: ${upserted.name}`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

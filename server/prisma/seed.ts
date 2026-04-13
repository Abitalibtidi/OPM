import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@opm.local' },
    update: {},
    create: {
      email: 'admin@opm.local',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });

  // Create a demo analyst
  const analystPassword = await bcrypt.hash('analyst123!', 12);
  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@opm.local' },
    update: {},
    create: {
      email: 'analyst@opm.local',
      passwordHash: analystPassword,
      name: 'Demo Analyst',
      role: 'analyst',
    },
  });

  // Create a demo reviewer
  const reviewerPassword = await bcrypt.hash('reviewer123!', 12);
  await prisma.user.upsert({
    where: { email: 'reviewer@opm.local' },
    update: {},
    create: {
      email: 'reviewer@opm.local',
      passwordHash: reviewerPassword,
      name: 'Demo Reviewer',
      role: 'reviewer',
    },
  });

  // Create a sample valuation
  const valuation = await prisma.valuation.create({
    data: {
      name: 'Sample Series B Valuation',
      description: 'Example OPM valuation for a Series B startup with common and preferred shares.',
      companyName: 'Acme Technologies Inc.',
      valuationDate: '2024-12-31',
      totalEquityValue: 50000000,
      volatility: 0.65,
      riskFreeRate: 0.045,
      term: 4.0,
      dividendYield: 0,
      createdById: analyst.id,
    },
  });

  // Add share classes
  await prisma.shareClass.createMany({
    data: [
      {
        valuationId: valuation.id,
        name: 'Common Stock',
        type: 'common',
        sharesOutstanding: 8000000,
        issuePrice: 0.01,
        liquidationPreference: 0,
        isParticipating: false,
        participationCap: 0,
        conversionRatio: 1,
        seniorityLevel: 3,
        liquidationSeniority: 'junior',
        strikePrice: 0,
        vestingPercent: 100,
        sortOrder: 0,
      },
      {
        valuationId: valuation.id,
        name: 'Series A Preferred',
        type: 'preferred',
        sharesOutstanding: 3000000,
        issuePrice: 2.00,
        liquidationPreference: 6000000,
        isParticipating: true,
        participationCap: 3,
        conversionRatio: 1,
        seniorityLevel: 2,
        liquidationSeniority: 'pari_passu',
        strikePrice: 0,
        vestingPercent: 100,
        sortOrder: 1,
      },
      {
        valuationId: valuation.id,
        name: 'Series B Preferred',
        type: 'preferred',
        sharesOutstanding: 2000000,
        issuePrice: 5.00,
        liquidationPreference: 10000000,
        isParticipating: false,
        participationCap: 0,
        conversionRatio: 1,
        seniorityLevel: 1,
        liquidationSeniority: 'senior',
        strikePrice: 0,
        vestingPercent: 100,
        sortOrder: 2,
      },
      {
        valuationId: valuation.id,
        name: 'Employee Stock Options',
        type: 'option',
        sharesOutstanding: 2000000,
        issuePrice: 0,
        liquidationPreference: 0,
        isParticipating: false,
        participationCap: 0,
        conversionRatio: 1,
        seniorityLevel: 3,
        liquidationSeniority: 'junior',
        strikePrice: 1.50,
        vestingPercent: 75,
        sortOrder: 3,
      },
    ],
  });

  console.log('Seed complete!');
  console.log('');
  console.log('Default accounts:');
  console.log('  Admin:    admin@opm.local    / admin123!');
  console.log('  Analyst:  analyst@opm.local  / analyst123!');
  console.log('  Reviewer: reviewer@opm.local / reviewer123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

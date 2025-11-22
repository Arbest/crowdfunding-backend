import 'dotenv/config';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User, Session, Project, Contribution, AuditLog } from '../models/index.js';
import { UserRole, ProjectStatus, ProjectCategory, ContributionStatus, PaymentProvider } from '../types/index.js';

const SALT_ROUNDS = 12;
const PASSWORD = 'Test1234'; // Stejné heslo pro všechny

interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  _id?: string;
}

const testUsers: TestUser[] = [
  {
    email: 'user@test.cz',
    password: PASSWORD,
    firstName: 'Jan',
    lastName: 'Novák',
    roles: [UserRole.USER],
  },
  {
    email: 'founder@test.cz',
    password: PASSWORD,
    firstName: 'Petr',
    lastName: 'Svoboda',
    roles: [UserRole.USER, UserRole.FOUNDER],
  },
  {
    email: 'admin@test.cz',
    password: PASSWORD,
    firstName: 'Admin',
    lastName: 'Hlavní',
    roles: [UserRole.ADMIN],
  },
];

async function clearDatabase() {
  console.log('🗑️  Mazání existujících dat...');
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    Project.deleteMany({}),
    Contribution.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('✓ Data smazána\n');
}

async function seedUsers() {
  console.log('👤 Vytváření uživatelů...');

  for (const userData of testUsers) {
    const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);

    const user = await User.create({
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      roles: userData.roles,
      stats: {
        totalContributed: 0,
        totalProjectsOwned: 0,
      },
    });

    userData._id = user._id.toString();
    console.log(`  ✓ ${userData.firstName} ${userData.lastName} (${userData.roles.join(', ')})`);
  }

  console.log('');
}

async function seedProjects() {
  console.log('📋 Vytváření projektů...');

  const founder = testUsers.find((u) => u.roles.includes(UserRole.FOUNDER))!;

  // Draft projekt
  const draftProject = await Project.create({
    ownerId: founder._id,
    title: 'Chytrý květináč s AI',
    shortDescription: 'Květináč který sám zalévá rostliny pomocí umělé inteligence',
    description: 'Podrobný popis projektu chytrého květináče, který využívá AI k optimální péči o rostliny. Měří vlhkost půdy, teplotu, světlo a automaticky zalévá podle potřeb konkrétní rostliny.',
    category: ProjectCategory.TECHNOLOGY,
    targetAmount: 50000,
    currency: 'CZK',
    status: ProjectStatus.DRAFT,
    deadlineAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 dní
    images: ['https://picsum.photos/800/600?random=1'],
    rewards: [],
  });
  console.log(`  ✓ ${draftProject.title} (${draftProject.status})`);

  // Active projekt s rewards
  const activeProject = await Project.create({
    ownerId: founder._id,
    title: 'Eco-friendly batohy z recyklovaných materiálů',
    shortDescription: 'Stylové a funkční batohy vyrobené z recyklovaných plastových lahví',
    description: 'Naše batohy jsou vyrobeny ze 100% recyklovaných plastových lahví. Každý batoh zachrání přibližně 20 PET lahví před skládkou. Jsou vodotěsné, lehké a mají doživotní záruku.',
    category: ProjectCategory.DESIGN,
    targetAmount: 100000,
    currency: 'CZK',
    status: ProjectStatus.ACTIVE,
    publishedAt: new Date(),
    deadlineAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dní
    images: [
      'https://picsum.photos/800/600?random=2',
      'https://picsum.photos/800/600?random=3',
    ],
    rewards: [
      {
        id: crypto.randomUUID(),
        title: 'Poděkování',
        description: 'Vaše jméno na webu projektu',
        price: 100,
        currency: 'CZK',
        limit: null,
        backersCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        title: 'Early Bird - Malý batoh',
        description: 'Malý eco-friendly batoh (20L) v barvě dle výběru + poděkování',
        price: 500,
        currency: 'CZK',
        limit: 50,
        backersCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        title: 'Velký batoh Premium',
        description: 'Velký batoh (35L) s laptop kapsou + personalizace + poděkování',
        price: 1200,
        currency: 'CZK',
        limit: 30,
        backersCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    stats: {
      currentAmount: 1000,
      backerCount: 2,
    },
  });
  console.log(`  ✓ ${activeProject.title} (${activeProject.status})`);

  // Pending projekt
  const pendingProject = await Project.create({
    ownerId: founder._id,
    title: 'Mobilní aplikace pro učení jazyků s AI',
    shortDescription: 'Naučte se nový jazyk pomocí pokročilé AI a rozpoznávání řeči',
    description: 'Revoluční mobilní aplikace která využívá AI k personalizovanému učení jazyků. Aplikace se přizpůsobuje vašemu tempu, zájmům a učebnímu stylu. Obsahuje rozpoznávání řeči, konverzační AI tutora a gamifikované lekce.',
    category: ProjectCategory.TECHNOLOGY,
    targetAmount: 200000,
    currency: 'CZK',
    status: ProjectStatus.PENDING_APPROVAL,
    deadlineAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 dní
    images: ['https://picsum.photos/800/600?random=4'],
    rewards: [
      {
        id: crypto.randomUUID(),
        title: 'Beta přístup',
        description: '3 měsíce zdarma + beta tester badge',
        price: 200,
        currency: 'CZK',
        limit: 100,
        backersCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
  console.log(`  ✓ ${pendingProject.title} (${pendingProject.status})`);

  // Update founder stats
  await User.findByIdAndUpdate(founder._id, {
    $set: { 'stats.totalProjectsOwned': 3 },
  });

  console.log('');
  return { activeProject };
}

async function seedContributions(activeProject: { _id: unknown; rewards: Array<{ id: string }> }) {
  console.log('💰 Vytváření příspěvků...');

  const user = testUsers.find((u) => u.email === 'user@test.cz')!;

  // User contribution
  const userContribution = await Contribution.create({
    userId: user._id,
    projectId: activeProject._id,
    rewardId: activeProject.rewards[1].id,
    amount: 500,
    currency: 'CZK',
    status: ContributionStatus.SUCCEEDED,
    paidAt: new Date(),
    payment: {
      provider: PaymentProvider.STRIPE,
      intentId: 'pi_mock_' + crypto.randomBytes(8).toString('hex'),
      chargeId: 'ch_mock_' + crypto.randomBytes(8).toString('hex'),
      raw: {
        method: 'card',
        brand: 'visa',
        last4: '4242',
      },
    },
  });
  console.log(`  ✓ Příspěvek od ${user.firstName} (${userContribution.amount} CZK)`);

  // Anonymous contribution
  const anonContribution = await Contribution.create({
    userId: null,
    projectId: activeProject._id,
    rewardId: activeProject.rewards[1].id,
    amount: 500,
    currency: 'CZK',
    status: ContributionStatus.SUCCEEDED,
    paidAt: new Date(),
    payment: {
      provider: PaymentProvider.STRIPE,
      intentId: 'pi_mock_' + crypto.randomBytes(8).toString('hex'),
      chargeId: 'ch_mock_' + crypto.randomBytes(8).toString('hex'),
      raw: {
        method: 'card',
        brand: 'mastercard',
        last4: '5555',
      },
    },
  });
  console.log(`  ✓ Anonymní příspěvek (${anonContribution.amount} CZK)`);

  // Update user stats
  await User.findByIdAndUpdate(user._id, {
    $set: { 'stats.totalContributed': 500 },
  });

  console.log('');
}

async function seed() {
  console.log('🌱 Seed testovacích dat\n');

  try {
    await connectDatabase();

    // Clear existing data
    await clearDatabase();

    // Seed data
    await seedUsers();
    const { activeProject } = await seedProjects();
    await seedContributions(activeProject);

    console.log('✅ Seed dokončen!\n');

    // Print login credentials
    console.log('═'.repeat(50));
    console.log('🔑 Přihlašovací údaje:');
    console.log('═'.repeat(50));
    console.log('');
    testUsers.forEach((user) => {
      console.log(`${user.roles.includes(UserRole.ADMIN) ? '👑' : user.roles.includes(UserRole.FOUNDER) ? '🏗️' : '👤'} ${user.firstName} ${user.lastName}`);
      console.log(`   Email:    ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Roles:    ${user.roles.join(', ')}`);
      console.log('');
    });
    console.log('═'.repeat(50));

    await disconnectDatabase();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();

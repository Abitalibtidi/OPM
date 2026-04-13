-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyName" TEXT NOT NULL,
    "valuationDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalEquityValue" REAL NOT NULL DEFAULT 0,
    "volatility" REAL NOT NULL DEFAULT 0.60,
    "riskFreeRate" REAL NOT NULL DEFAULT 0.04,
    "term" REAL NOT NULL DEFAULT 3.0,
    "dividendYield" REAL NOT NULL DEFAULT 0,
    "backsolveTargetClassId" TEXT,
    "backsolveTargetPPS" REAL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Valuation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "valuationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'common',
    "sharesOutstanding" REAL NOT NULL DEFAULT 0,
    "issuePrice" REAL NOT NULL DEFAULT 0,
    "liquidationPreference" REAL NOT NULL DEFAULT 0,
    "isParticipating" BOOLEAN NOT NULL DEFAULT false,
    "participationCap" REAL NOT NULL DEFAULT 0,
    "conversionRatio" REAL NOT NULL DEFAULT 1.0,
    "seniorityLevel" INTEGER NOT NULL DEFAULT 1,
    "liquidationSeniority" TEXT NOT NULL DEFAULT 'pari_passu',
    "strikePrice" REAL NOT NULL DEFAULT 0,
    "vestingPercent" REAL NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShareClass_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValuationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "valuationId" TEXT NOT NULL,
    "shareClassId" TEXT NOT NULL,
    "optionValue" REAL NOT NULL,
    "perShareValue" REAL NOT NULL,
    "totalValue" REAL NOT NULL,
    "allocationPercent" REAL NOT NULL,
    "fullyDilutedShares" REAL NOT NULL,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValuationResult_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ValuationResult_shareClassId_fkey" FOREIGN KEY ("shareClassId") REFERENCES "ShareClass" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "valuationId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

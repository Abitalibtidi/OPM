-- CreateTable
CREATE TABLE "BreakpointRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "valuationId" TEXT NOT NULL,
    "equityValue" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "cumulativePreference" REAL NOT NULL,
    "participants" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "BreakpointRecord_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrancheRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "valuationId" TEXT NOT NULL,
    "lowerBreakpoint" REAL NOT NULL,
    "upperBreakpoint" REAL,
    "callValueLower" REAL NOT NULL,
    "callValueUpper" REAL NOT NULL,
    "trancheValue" REAL NOT NULL,
    "allocations" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "TrancheRecord_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BreakpointRecord_valuationId_idx" ON "BreakpointRecord"("valuationId");

-- CreateIndex
CREATE INDEX "TrancheRecord_valuationId_idx" ON "TrancheRecord"("valuationId");

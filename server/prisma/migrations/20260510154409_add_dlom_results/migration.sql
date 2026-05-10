-- CreateTable
CREATE TABLE "DLOMResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "valuationId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "volatility" REAL NOT NULL,
    "holdingPeriod" REAL NOT NULL,
    "riskFreeRate" REAL NOT NULL,
    "dlomPercentage" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DLOMResult_valuationId_fkey" FOREIGN KEY ("valuationId") REFERENCES "Valuation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DLOMResult_valuationId_idx" ON "DLOMResult"("valuationId");

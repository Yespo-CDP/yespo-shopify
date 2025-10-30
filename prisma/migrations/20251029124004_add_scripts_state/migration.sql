-- AlterTable
ALTER TABLE "public"."Shop" ADD COLUMN     "isGeneralScriptInstalled" BOOLEAN DEFAULT false,
ADD COLUMN     "isWebPushScriptInstalled" BOOLEAN DEFAULT false;

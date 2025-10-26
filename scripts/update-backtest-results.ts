import { PrismaClient } from '@prisma/client';
import { BACKTEST_RESULTS } from './backtest-results-data';

const prisma = new PrismaClient();

async function updateBacktestResults() {
  try {
    console.log('🔄 Updating existing strategies with backtest results...\n');

    // Map of systemDefaultType to backtest results
    const backtestMapping = {
      'SCALP_WEEKDAY': BACKTEST_RESULTS.SCALP_WEEKDAY,
      'SWING_WEEKDAY': BACKTEST_RESULTS.SWING_WEEKDAY,
      'GOLD_SCALP_WEEKDAY': BACKTEST_RESULTS.GOLD_SCALP_WEEKDAY,
      'GOLD_SWING_WEEKDAY': BACKTEST_RESULTS.GOLD_SWING_WEEKDAY,
      'SCALP_WEEKEND': BACKTEST_RESULTS.SCALP_WEEKEND,
      'SWING_WEEKEND': BACKTEST_RESULTS.SWING_WEEKEND,
    };

    // Find all system default strategies
    const strategies = await prisma.strategy.findMany({
      where: {
        isSystemDefault: true,
      },
    });

    console.log(`Found ${strategies.length} system default strategies\n`);

    let updatedCount = 0;

    for (const strategy of strategies) {
      const backtestData = backtestMapping[strategy.systemDefaultType as keyof typeof backtestMapping];

      if (backtestData) {
        await prisma.strategy.update({
          where: {
            id: strategy.id,
          },
          data: {
            backtestResults: backtestData as any,
            backtestVerified: true,
          },
        });

        console.log(`✅ Updated: ${strategy.name}`);
        console.log(`   Type: ${strategy.systemDefaultType}`);
        console.log(`   Return: +${(backtestData.performance.returnPercentage).toFixed(2)}%`);
        console.log(`   Win Rate: ${backtestData.statistics.winRate.toFixed(1)}%`);
        console.log(`   Profit Factor: ${backtestData.statistics.profitFactor.toFixed(2)}`);
        console.log('');

        updatedCount++;
      } else {
        console.log(`⚠️  No backtest data for: ${strategy.name} (${strategy.systemDefaultType})`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`✅ ${updatedCount} strategies updated with backtest results!`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Verify all strategies have backtest data
    const verified = await prisma.strategy.count({
      where: {
        isSystemDefault: true,
        backtestVerified: true,
      },
    });

    console.log(`📊 Verification: ${verified}/${strategies.length} strategies have backtest results\n`);

    if (verified === strategies.length) {
      console.log('🎉 All system default strategies are now backtested!');
    }

  } catch (error) {
    console.error('❌ Error updating backtest results:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateBacktestResults()
  .then(() => {
    console.log('\n✅ Success!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

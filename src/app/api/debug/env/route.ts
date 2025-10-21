import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Check authentication first
    const authHeader = request.headers.get("authorization");
    if (
      authHeader !== `Bearer ${process.env.DEBUG_TOKEN || "debug-token-123"}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Debug environment variables (masked for security)
    const envDebug = {
      TWELVEDATA_API_KEY: {
        exists: !!process.env.TWELVEDATA_API_KEY,
        length: process.env.TWELVEDATA_API_KEY?.length || 0,
        prefix:
          process.env.TWELVEDATA_API_KEY?.substring(0, 8) + "..." || "not-set",
      },
      YAHOO_FINANCE_API_KEY: {
        exists: !!process.env.YAHOO_FINANCE_API_KEY,
        length: process.env.YAHOO_FINANCE_API_KEY?.length || 0,
        prefix:
          process.env.YAHOO_FINANCE_API_KEY?.substring(0, 8) + "..." ||
          "not-set",
      },
      YAHOO_FINANCE_RAPIDAPI_HOST: {
        exists: !!process.env.YAHOO_FINANCE_RAPIDAPI_HOST,
        length: process.env.YAHOO_FINANCE_RAPIDAPI_HOST?.length || 0,
        prefix:
          process.env.YAHOO_FINANCE_RAPIDAPI_HOST?.substring(0, 8) + "..." ||
          "not-set",
      },
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_REGION: process.env.VERCEL_REGION,
    };

    // Test TwelveData API
    let twelveDataTest: {
      status: string;
      error: string | null;
      httpStatus?: number;
      httpStatusText?: string;
    } = { status: "not_tested", error: null };

    if (process.env.TWELVEDATA_API_KEY) {
      try {
        const response = await fetch(
          `https://api.twelvedata.com/time_series?symbol=XAUUSD&interval=1min&apikey=${process.env.TWELVEDATA_API_KEY}`,
        );
        twelveDataTest = {
          status: response.ok ? "success" : "failed",
          error: null,
          httpStatus: response.status,
          httpStatusText: response.statusText,
        };

        if (!response.ok) {
          const errorText = await response.text();
          twelveDataTest.error = errorText;
        }
      } catch (error) {
        twelveDataTest = {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envDebug,
      twelveDataTest,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug endpoint failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

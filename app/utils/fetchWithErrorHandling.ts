class FetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
) {
  try {
    const response = await fetch(url, options);

    const rawResponse = await response.text();
    let responseData: any = rawResponse;

    try {
      responseData = JSON.parse(rawResponse);
    } catch (e) {}

    if (!response.ok) {
      const message =
        typeof responseData === "string"
          ? responseData
          : responseData?.message || "Unknown error";
      throw new FetchError(message, response.status);
    }

    return responseData;
  } catch (error: any) {
    if (error instanceof FetchError) {
      throw error;
    }
    throw new FetchError(error.message || "Unexpected error", 500);
  }
}

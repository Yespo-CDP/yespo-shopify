import database from "~/db.server";

export async function getOfflineAccessToken(
  shopUrl: string,
): Promise<string | null> {
  const session = await database.session.findFirst({
    where: {
      shop: shopUrl,
      isOnline: false,
    },
    orderBy: {
      expires: "desc",
    },
  });

  return session?.accessToken ?? null;
}

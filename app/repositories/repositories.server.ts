import ShopRepositoryImpl from "~/repositories/shop/shopRepositoryImpl.server";
import database from "~/db.server";

const shopRepository = new ShopRepositoryImpl(database);

export { shopRepository };

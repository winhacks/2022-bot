import {MongoClient} from "mongodb";
import {Config} from "../config";

export let mongoClient: MongoClient;

export const AuthenticateMongo = async () => {
    mongoClient = new MongoClient(Config.mongo_db.database_url, {
        cert: Config.mongo_db.certificate,
        key: Config.mongo_db.private_key,
    });

    await mongoClient.connect();
};

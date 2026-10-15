jest.mock("mongoose");

// config/db reads MONGO_URI when it is loaded, so each test loads a fresh copy.
const loadDb = (mongoUri) => {
  let connectDB;
  let mongoose;
  jest.isolateModules(() => {
    if (mongoUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = mongoUri;
    mongoose = require("mongoose");
    mongoose.connection = { readyState: 0 };
    connectDB = require("../config/db");
  });
  return { connectDB, mongoose };
};

describe("connectDB", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports a missing MONGO_URI instead of connecting", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const { connectDB, mongoose } = loadDb(undefined);

    await connectDB();

    expect(mongoose.connect).not.toHaveBeenCalled();
    expect(connectDB.getDbStatus()).toEqual({
      state: "disconnected",
      error: "MONGO_URI is not configured",
    });
  });

  it("logs the error and exits when the connection fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    const { connectDB, mongoose } = loadDb("mongodb://db.example/kinderbuch");
    mongoose.connect.mockRejectedValueOnce(new Error("Connection failed!"));

    await connectDB();

    expect(console.error).toHaveBeenCalledWith("Connection failed!");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(connectDB.getDbStatus().error).toBe("Connection failed!");
  });
});

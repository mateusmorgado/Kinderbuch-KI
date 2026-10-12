const mongoose = require('mongoose');
const User = require('../models/User');
const { MongoMemoryServer } = require("mongodb-memory-server");

require("dotenv").config();

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "demo" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('User Model Test', () => {

  it('should create & save a user successfully', async () => {
    const validUser = new User({
      username: 'test.user',
      passwordHash: 'hashedpassword',
      displayName: 'Test User',
      kidsNames: ['Kid1', 'Kid2'],
    });
    const savedUser = await validUser.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.username).toBe('test.user');
    expect(savedUser.passwordHash).toBe(validUser.passwordHash);
    expect(savedUser.displayName).toBe(validUser.displayName);
    expect(savedUser.kidsNames).toEqual(expect.arrayContaining(validUser.kidsNames));
  });

  it('should lowercase and trim the username', async () => {
    const user = await new User({
      username: '  MixedCase  ',
      passwordHash: 'hashedpassword',
    }).save();

    expect(user.username).toBe('mixedcase');
  });

  it('should fail to create a user without required fields', async () => {
    const userWithoutRequiredField = new User({ displayName: 'Test User' });
    let err;
    try {
      await userWithoutRequiredField.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.username).toBeDefined();
    expect(err.errors.passwordHash).toBeDefined();
  });

  it('should fail to create a user with an invalid username', async () => {
    const userWithInvalidUsername = new User({
      username: 'no spaces!',
      passwordHash: 'hashedpassword',
    });
    let err;
    try {
      await userWithInvalidUsername.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.username).toBeDefined();
  });

  it('should not allow duplicate usernames', async () => {
    await User.init();
    await new User({ username: 'duplicate', passwordHash: 'hash' }).save();

    let err;
    try {
      await new User({ username: 'duplicate', passwordHash: 'hash' }).save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe(11000);
  });
});

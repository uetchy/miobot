const mongoose = require('mongoose')

const mongodbURI = process.env.MONGODB_URI
let cachedDB = null

async function connectToDatabase() {
  if (cachedDB) {
    return cachedDB
  }

  const client = await mongoose.createConnection(mongodbURI, {
    bufferCommands: false, // Disable mongoose buffering
    bufferMaxEntries: 0, // and MongoDB driver buffering
    useNewUrlParser: true,
  })

  User = client.model(
    'User',
    new mongoose.Schema({
      userID: Number,
      username: String,
      token: String,
      tokenExpiresAt: Date,
      dataCap: Number,
      lastUpdate: { type: Date, default: Date.now() },
      lastCheck: { type: Date, default: Date.now() },
    })
  )

  cachedDB = client
  return client
}

async function createUser(userData) {
  const db = await connectToDatabase()
  const User = db.model('User')
  const user = new User(userData)
  const resp = await user.save()

  return resp
}

async function getUser(userID) {
  const db = await connectToDatabase()
  const User = db.model('User')
  const user = await User.findOne({ userID })

  return user
}

async function getAllUsers() {
  const db = await connectToDatabase()
  const User = db.model('User')
  const users = await User.find()

  return users
}

async function closeConnection() {
  const db = await connectToDatabase()
  db.close()
}

module.exports = {
  connectToDatabase,
  createUser,
  getUser,
  getAllUsers,
  closeConnection,
}

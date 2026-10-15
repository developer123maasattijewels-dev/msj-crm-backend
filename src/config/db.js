
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(
      'mongodb://developer123maasattijewels_db_user:Devmsj321@ac-f3y9r4n-shard-00-00.fmkmv4w.mongodb.net:27017,ac-f3y9r4n-shard-00-01.fmkmv4w.mongodb.net:27017,ac-f3y9r4n-shard-00-02.fmkmv4w.mongodb.net:27017/?ssl=true&replicaSet=atlas-630sda-shard-0&authSource=admin'
    );

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
};

module.exports = connectDB;

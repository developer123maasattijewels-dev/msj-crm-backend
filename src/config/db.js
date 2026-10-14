
const mongoose = require('mongoose');

const Jewels = mongoose.connect('mongodb://127.0.0.1:27017/msjjewels')
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((error) => {
        console.log('MongoDB not connected:', error.message);
    });

module.exports = Jewels;

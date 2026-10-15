const express = require('express')
const cors = require('cors')
const connectDB = require('./src/config/db')

const app = express()
app.use(express.json())


connectDB()

app.listen(5000, () => {
    console.log('server is running on port 5000')
})

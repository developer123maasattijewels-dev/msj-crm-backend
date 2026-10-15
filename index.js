require('dotenv').config();

const express = require('express')
const cors = require('cors')
const connectDB = require('./src/config/db')
const router = require('./src/routes/leadsroutes')

const app = express()
app.use(express.json())


connectDB()


app.use('/leads', router)


app.listen(5000, () => {
    console.log('server is running on port 5000')
})

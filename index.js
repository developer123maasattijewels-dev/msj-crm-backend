const express = require('express')
const cors = require('cors')
const Jewels = require('./src/config/db')


const app = express()
app.use(express.json())


Jewels()






app.listen(5000 , ()=>{
    console.log('server is running on port 5000')
})
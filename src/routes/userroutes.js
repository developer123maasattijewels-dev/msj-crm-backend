const express = require('express');
const { add, get, getByid, deleteUsers, update } = require('../controller/Users');
const router = express.Router();



router.post('/add', add);
router.get('/users', get);
router.get('/users/:id', getByid);
router.delete('/deleteuser/:id', deleteUsers);
router.put('/updateuser/:id', update);




module.exports = router
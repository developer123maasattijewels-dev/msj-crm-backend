const express = require('express');
const { add, get, getByid, deleteUsers, update, login } = require('../controller/Users');
const router = express.Router();

router.post('/login', login);
router.post('/add', add);
router.get('/', get);
router.get('/users', get);
router.get('/:id', getByid);
router.get('/users/:id', getByid);
router.delete('/deleteuser/:id', deleteUsers);
router.delete('/:id', deleteUsers);
router.put('/updateuser/:id', update);
router.put('/:id', update);

module.exports = router;
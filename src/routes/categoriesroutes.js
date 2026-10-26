const express = require('express');
const { addCategories, getCategories, updateCategories, deleteCategories } = require('../controller/categoriesController');
const router = express.Router();


router.post('/add', addCategories);
router.get('/get', getCategories);
router.put('/update/:id', updateCategories);
router.delete('/delete/:id', deleteCategories);


module.exports = router;
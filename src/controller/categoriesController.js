
const Categories = require('../models/categories');

// ADD CATEGORY
const addCategories = async (req, res) => {
    try {
        const { name, subCategories, description } = req.body;

        const category = await Categories.create({
            name,
            subCategories,
            description
        });

        res.status(201).json({
            success: true,
            message: 'Category added successfully',
            category
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Category could not be added',
            error: error.message
        });
    }
};

const getCategories = async (req, res) => {
    try {
        const { status, name, subCategory } = req.query;

        const filter = {};

        // Active / Inactive filter
        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        // Department filter
        if (name) {
            filter.name = name;
        }

        // Subcategory filter
        if (subCategory) {
            filter.subCategories = {
                $regex: subCategory,
                $options: 'i'
            };
        }

        const categories = await Categories.find(filter)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Categories could not be fetched',
            error: error.message
        });
    }
};

const updateCategories = async (req, res) => {
    try {
        const { name, subCategories, description, isActive } = req.body;

        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (subCategories !== undefined) {
            updateData.subCategories = subCategories;
        }
        if (description !== undefined) {
            updateData.description = description;
        }
        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        const category = await Categories.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            {
                new: true,
                runValidators: true
            }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            category
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Category could not be updated',
            error: error.message
        });
    }
};
const deleteCategories = async (req, res) => {
    try {
        const category = await Categories.findByIdAndDelete(
            req.params.id
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully',
            category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Category could not be deleted',
            error: error.message
        });
    }
};

module.exports = {
    addCategories,
    getCategories,
    updateCategories,
    deleteCategories
};

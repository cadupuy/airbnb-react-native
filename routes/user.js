const express = require("express");
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

const User = require("../models/User");
const isAuthenticated = require("../middlewares/isAuthenticated");

router.post("/user/signup", async (req, res) => {
  try {
    const { password, username, email, description } = req.fields;

    if (!password || !username || !email || !description) {
      res.status(400).json({
        message: "Missing parameter",
      });
    } else {
      const userEmail = await User.findOne({ email: email });
      const userUsername = await User.findOne({ "account.username": username });

      if (userEmail) {
        res.status(400).json({
          message: "This email already has an account",
        });
      } else if (userUsername) {
        res.status(400).json({
          message: "This username already has an account",
        });
      } else {
        const salt = uid2(16);
        const hash = SHA256(password + salt).toString(encBase64);
        const user = new User({
          email,
          account: {
            username,
            description,
          },
          token: uid2(16),
          hash,
          salt,
        });
        await user.save();
        res.status(200).json({
          _id: user._id,
          email: user.email,
          account: user.account,
          token: user.token,
        });
      }
    }
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

router.post("/user/login", async (req, res) => {
  try {
    const { password, email } = req.fields;
    const user = await User.findOne({ email: email });

    if (!password || !email) {
      res.status(400).json({
        message: "Missing parameter",
      });
    } else {
      if (!user) {
        res.status(400).json({
          message: "This account does not exist",
        });
      } else if (
        // Comparing Hash in DB to the result of password req.fields + salt in DB
        user.hash === SHA256(password + user.salt).toString(encBase64)
      ) {
        res.status(200).json({
          _id: user._id,
          email: user.email,
          account: user.account,
          token: user.token,
        });
      } else {
        res.status(401).json({
          message: "Unauthorized",
        });
      }
    }
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

router.put("/user/upload_picture/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const user = await User.findById(req.params.id);
      if (!user) {
        res.status(400).json({
          message: "User not found",
        });
      } else {
        if (String(user.id) === String(req.user.id)) {
          if (!req.files.photo) {
            res.status(400).json({
              message: "Missing photo",
            });
          } else {
            let pictureCloudinary;
            const pictureUser = {};
            const pictureToUpload = req.files.photo.path;
            if (!user.account.photo) {
              pictureCloudinary = await cloudinary.uploader.upload(
                pictureToUpload,
                {
                  folder: "/airbnb/" + req.params.id,
                }
              );
            } else {
              pictureCloudinary = await cloudinary.uploader.upload(
                pictureToUpload,
                {
                  public_id: user.account.photo.picture_id,
                  folder: "/airbnb/" + req.params.id,
                }
              );
            }
            pictureUser.url = pictureCloudinary.secure_url;
            pictureUser.picture_id = pictureCloudinary.public_id;
            user.account.photo = pictureUser;

            await user.save();
            res.status(200).json({
              _id: user._id,
              email: user.email,
              account: user.account,
              rooms: user.rooms,
            });
          }
        } else {
          res.status(400).json({
            message: "Unauthorized",
          });
        }
      }
    } else {
      res.status(400).json({
        message: "Missing Id",
      });
    }
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

router.put("/user/delete_picture/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const user = await User.findById(req.params.id);
      if (!user) {
        res.status(400).json({
          message: "User not found",
        });
      } else {
        if (String(user.id) === String(req.user.id)) {
          if (!user.account.photo) {
            res.status(400).json({
              message: "No photo found",
            });
          } else {
            await cloudinary.uploader.destroy(user.account.photo.picture_id);
            user.account.photo = null;

            await user.save();
            res.status(200).json({
              _id: user._id,
              email: user.email,
              account: user.account,
              rooms: user.rooms,
            });
          }
        } else {
          res.status(400).json({
            message: "Unauthorized",
          });
        }
      }
    } else {
      res.status(400).json({
        message: "Missing Id",
      });
    }
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

module.exports = router;

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const fetch = require("node-fetch");
const app = express();
const Collection = require('./Schema');
const parser = require('body-parser')
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const passport=require('passport');


const port = process.env.PORT || 3000
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(cookieParser());
app.use(session({secret: 'secret'}));
app.use(flash());
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log("Connect to Database");
    })
    .catch((e) => {
        console.log("ERROR!!!!!!!!!!!!!!!!!!! ", e);
    });


app.use(parser.json());
app.use(parser.urlencoded({ extended: true }));


const requireLogin=(req,res,next)=>{
    if(!req.session.user_id){
        return res.redirect('/login');
    }
    next();
}

passport.serializeUser((user,done)=>{
    done(null,user.id);
})

passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback   : true
  },
  async function(request, accessToken, refreshToken, profile, done) {
    const userName = profile.displayName;
    const email = profile.emails[0].value;
    const newUser = await new Collection({
        name: userName,
        email: email,
        password: "defaultPassword"
    })
    request.session.user_id = newUser.id;
    await newUser.save()
    return done(null,profile);
  }
));


app.get('/auth/google', passport.authenticate('google', { scope:
      [ 'email', 'profile' ] }
));

app.get( '/auth/google/callback',passport.authenticate( 'google', {
    successRedirect: '/auth/google/success',
    failureRedirect: '/auth/google/failure'
}));


app.get('/auth/google/success',(req,res)=>{
  req.session.user_id = "userlogin",
  res.redirect('/');
})
app.get('/auth/google/failure',(req,res)=>{
    res.redirect('/login');
  })

app.get("/login", (req, res) => {
    res.render('component/login', { message: req.flash('message') });
})

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const error = [];
    const user = await Collection.findOne({ email });
    if(!user){
        res.redirect('/login');
        return;
    }
    const validPass=await bcrypt.compare(password,user.password);
    if(validPass){
     req.session.user_id=user.email;
     res.redirect('/');
    }else
     res.redirect('/login'); 
});

app.get("/", requireLogin, async (req, res) => {
        let fetchRes = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${process.env.API_KEY}`)
        .then(response => response.json());
    res.render('component/home', { fetchRes });
});

app.get("/register", async (req, res) => {
    res.render('component/register', { message: req.flash('message') });
})

app.post("/register", async (req, res) => {
    const error = [];
    const { name, email, password, cpassword } = req.body;
    if (!name || !email || !password || !cpassword) {
        error.push("All feilds are mandotory!");
    } else if (password != cpassword) {
        error.push("Password didn't match");
    } else if (password.length < 6) {
        error.push("Password must be greater than 6 charaters");
    } else {
        const user = await Collection.findOne({ email });
        if (user) error.push("Email already register!");
    }
    if (error.length > 0) {
        req.flash('message', error[0]);
        res.redirect('/register');
    } else {
        const hashedPassword = await bcrypt.genSalt(10).then(salt=>{
            return bcrypt.hash(password,salt);
            
        })

        
        const newUser = Collection.create({
            name,
            email,
            password: hashedPassword
        })
        req.flash('message', "You are registered successfully");
        res.redirect('/login');
    }
})

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect('/login');
})

app.listen(port, () => {
    console.log(`listening on port ${port}`);
})


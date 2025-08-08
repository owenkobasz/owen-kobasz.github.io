import './sass/main.scss';
import canvasDots from './headerCanvas.js';
import canvasDotsBg from './backgroundCanvas.js';
import Typed from 'typed.js';
import { sendEmail } from './emailjs.js';

// Import all images
import htmlImg from './assets/html.png';
import reactImg from './assets/react.png';
import expressImg from './assets/express.png';
import jsImg from './assets/js.png';
import cssImg from './assets/css.png';
import mongoImg from './assets/mongo.png';
import gitImg from './assets/git.png';
import sassImg from './assets/sass.png';
import nextjsImg from './assets/nextjs.png';
import nodeImg from './assets/node.png';
import githubLogoImg from './assets/github-logo.png';
import mailImg from './assets/mail.png';
import linkedinLogoImg from './assets/linkedin_logo.png';
import aboutImg from './assets/about.jpg';
import turboImg from './assets/turbo.jpg';
import cycloneImg from './assets/cyclone.jpg';

// Import resume
import resumeFile from './assets/resume.pdf';

window.onload = function () {
    canvasDotsBg();
    canvasDots();

    // Typed Initiate
    if (document.querySelector('.typed-text-output')) {
        const typedStrings = document.querySelector('.typed-text').textContent;
        const typed = new Typed('.typed-text-output', {
            strings: typedStrings.split(', '),
            typeSpeed: 100,
            backSpeed: 20,
            smartBackspace: false,
            loop: true
        });
    }

    // Set image sources after webpack processes them
    document.querySelector('.profile__picture img').src = aboutImg;
    document.querySelector('.skills__item--html img').src = htmlImg;
    document.querySelector('.skills__item--react img').src = reactImg;
    document.querySelector('.skills__item--npm img').src = expressImg;
    document.querySelector('.skills__item--js img').src = jsImg;
    document.querySelector('.skills__item--css img').src = cssImg;
    document.querySelector('.skills__item--python img').src = mongoImg;
    document.querySelector('.skills__item--git img').src = gitImg;
    document.querySelector('.skills__item--sass img').src = sassImg;
    document.querySelector('.skills__item--webpack img').src = nextjsImg;
    document.querySelector('.skills__item--r img').src = nodeImg;

    // Project images
    document.querySelector('.project-left .project__image-image img').src = cycloneImg;
    document.querySelector('.project-right .project__image-image img').src = turboImg;

    // Footer images
    document.querySelector('.socials__github img').src = githubLogoImg;
    document.querySelector('.socials__email img').src = mailImg;
    document.querySelector('.socials__linkedin img').src = linkedinLogoImg;

    // Set resume link
    document.getElementById('resume-link').href = resumeFile;
};

// loads in about section on scroll
function aboutFadeIn(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting && document.body.scrollWidth > 1300) {
            // console.log('yo');
            // fade in bio
            document.querySelector('.profile').classList.add('profile__fade-in');

            // fade in skills 1 at a time after bio has loaded
            const sleep = (milliseconds) => {
                return new Promise((resolve) => setTimeout(resolve, milliseconds));
            };

            //html
            sleep(1000).then(() => {
                document
                    .querySelector('.skills__item--html')
                    .classList.add('skills__item-fade-in');
            });

            //webpack
            sleep(1100).then(() => {
                document
                    .querySelector('.skills__item--webpack')
                    .classList.add('skills__item-fade-in');
            });

            //js
            sleep(1200).then(() => {
                document
                    .querySelector('.skills__item--js')
                    .classList.add('skills__item-fade-in');
            });

            //git
            sleep(1300).then(() => {
                document
                    .querySelector('.skills__item--git')
                    .classList.add('skills__item-fade-in');
            });

            //sass
            sleep(1400).then(() => {
                document
                    .querySelector('.skills__item--sass')
                    .classList.add('skills__item-fade-in');
            });

            //node
            sleep(1500).then(() => {
                document
                    .querySelector('.skills__item--npm')
                    .classList.add('skills__item-fade-in');
            });

            //py
            sleep(1600).then(() => {
                document
                    .querySelector('.skills__item--python')
                    .classList.add('skills__item-fade-in');
            });

            //react
            sleep(1700).then(() => {
                document
                    .querySelector('.skills__item--react')
                    .classList.add('skills__item-fade-in');
            });

            //r
            sleep(1800).then(() => {
                document
                    .querySelector('.skills__item--r')
                    .classList.add('skills__item-fade-in');
            });

            //css
            sleep(1900).then(() => {
                document
                    .querySelector('.skills__item--css')
                    .classList.add('skills__item-fade-in');
            });
        }
    });
}

let options = {
    root: null,
    rootMargin: '0px',
    threshold: 0.5,
};

let options2 = {
    root: null,
    rootMargin: '0px',
    threshold: 0.2,
};

let observer = new IntersectionObserver(aboutFadeIn, options);

observer.observe(document.querySelector('.about__content'));

// navigation items in nav bar
const navLinks = document.querySelectorAll('.navigation__item');

// change highlighted nav link depending on page position
function navFadeIn(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            // console.log(entry.target.id);

            navLinks.forEach((link) => {
                link.classList.remove('navigation__item--active');
            });

            document
                .querySelector(`#nav-${entry.target.id}`)
                .classList.add('navigation__item--active');
        }
    });
}

// projects section is a lot longer and needs custom settings
function navFadeInProjects(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            // console.log(entry.target.id);

            navLinks.forEach((link) => {
                link.classList.remove('navigation__item--active');
            });

            document
                .querySelector(`#nav-${entry.target.id}`)
                .classList.add('navigation__item--active');
        }
    });
}

let observerNav = new IntersectionObserver(navFadeIn, options);

observerNav.observe(document.querySelector('#hero'));
observerNav.observe(document.querySelector('#about'));
observerNav.observe(document.querySelector('#contact'));

let observerNavProjects = new IntersectionObserver(navFadeInProjects, options2);

observerNavProjects.observe(document.querySelector('#projects'));

// parralax scrolling effect on hero canvas

// window.onscroll = function (e) {
//   console.log(document.scrollTop);
// };

// document.addEventListener('scroll', () => {
//   // console.log(window.scrollY);

//   document.querySelector('.connecting-dots').style.top = `${window.scrollY}px`;
// });

// form validation

const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
document.querySelector('#form-submit').addEventListener('click', () => {
    const unameInput = document.querySelector('.contact__form-name');
    const emailInput = document.querySelector('.contact__form-email');
    const msgInput = document.querySelector('.contact__form-message');

    const uname = unameInput.value;
    const email = emailInput.value;
    const msg = msgInput.value;

    const unameError = document.querySelector('.form-error__name');
    const emailError = document.querySelector('.form-error__email');
    const msgError = document.querySelector('.form-error__msg');

    let validUname = false;
    let validEmail = false;
    let validMsg = false;

    // console.log(uname, email, msg);
    if (!uname) {
        validUname = false;
        unameInput.classList.add('input-error');
        unameError.style.display = 'block';
    } else {
        validUname = true;
        unameInput.classList.remove('input-error');
        unameError.style.display = 'none';
    }

    if (!email.match(re)) {
        validEmail = false;
        emailInput.classList.add('input-error');
        emailError.style.display = 'block';
    } else {
        validEmail = true;
        emailInput.classList.remove('input-error');
        emailError.style.display = 'none';
    }

    if (!msg) {
        validMsg = false;
        msgInput.classList.add('input-error');
        msgError.style.display = 'block';
    } else {
        validMsg = true;
        msgInput.classList.remove('input-error');
        msgError.style.display = 'none';
    }

    if (validUname && validEmail && validMsg) {
        // Submit to Firebase instead of default form submission
        const formData = {
            name: uname,
            email: email,
            message: msg
        };

        // Show loading state
        const submitButton = document.querySelector('#form-submit');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;

        // Send email via EmailJS only
        sendEmail(formData).then((emailResult) => {
            if (emailResult.success) {
                // Show success message
                submitButton.textContent = 'Sent!';
                submitButton.style.color = '#4CAF50';

                // Clear form
                document.querySelector('.contact__form').reset();

                // Reset button after delay
                setTimeout(() => {
                    submitButton.textContent = originalText;
                    submitButton.style.color = '';
                    submitButton.disabled = false;
                }, 3000);
            } else {
                // Show error message
                submitButton.textContent = 'Error!';
                submitButton.style.color = '#f44336';

                // Reset button after delay
                setTimeout(() => {
                    submitButton.textContent = originalText;
                    submitButton.style.color = '';
                    submitButton.disabled = false;
                }, 3000);

                console.error('Email sending failed:', emailResult);
            }
        }).catch((error) => {
            submitButton.textContent = 'Error!';
            submitButton.style.color = '#f44336';
            setTimeout(() => {
                submitButton.textContent = originalText;
                submitButton.style.color = '';
                submitButton.disabled = false;
            }, 3000);
            console.error('Email sending error:', error);
        });
    }
});

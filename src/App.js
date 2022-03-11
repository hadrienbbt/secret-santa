import React, { Component } from 'react'
import './App.css'

import Api from './lib/api'

import logo from './img/santa.png'

class App extends Component {

    constructor(props) {
        super(props)
        this.state = {
            user: {
                name: '',
                email: '',
                isValid: false,
            },
            logoStyle: {
                width: '200px',
            },
            blobStyle: {
                width: window.width,
                height: window.height,
            },
            navigationStack: [{
                id: 'MENU'
            }],
            create: '',
            join: {
                search: '',
                results: [],
                id_selected: null,
            }
        }
    }

    componentDidMount = () => {
        var flakes = [],
            canvas = this.refs.canvas,
            ctx = canvas.getContext("2d"),
            flakeCount = 400,
            mX = -100,
            mY = -100

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame ||
            function(callback) {
                window.setTimeout(callback, 1000 / 60);
            }
        window.requestAnimationFrame = requestAnimationFrame;

        function snow() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (var i = 0; i < flakeCount; i++) {
                var flake = flakes[i],
                    x = mX,
                    y = mY,
                    minDist = 150,
                    x2 = flake.x,
                    y2 = flake.y;

                var dist = Math.sqrt((x2 - x) * (x2 - x) + (y2 - y) * (y2 - y)),
                    dx = x2 - x,
                    dy = y2 - y;

                if (dist < minDist) {
                    var force = minDist / (dist * dist),
                        xcomp = (x - x2) / dist,
                        ycomp = (y - y2) / dist,
                        deltaV = force / 2;

                    flake.velX -= deltaV * xcomp;
                    flake.velY -= deltaV * ycomp;

                } else {
                    flake.velX *= .98;
                    if (flake.velY <= flake.speed) {
                        flake.velY = flake.speed
                    }
                    flake.velX += Math.cos(flake.step += .05) * flake.stepSize;
                }

                ctx.fillStyle = "rgba(255,255,255," + flake.opacity + ")";
                flake.y += flake.velY;
                flake.x += flake.velX;

                if (flake.y >= canvas.height || flake.y <= 0) {
                    reset(flake);
                }


                if (flake.x >= canvas.width || flake.x <= 0) {
                    reset(flake);
                }

                ctx.beginPath();
                ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
                ctx.fill();
            }
            requestAnimationFrame(snow);
        };

        function reset(flake) {
            flake.x = Math.floor(Math.random() * canvas.width);
            flake.y = 0;
            flake.size = (Math.random() * 3) + 2;
            flake.speed = (Math.random() * 1) + 0.5;
            flake.velY = flake.speed;
            flake.velX = 0;
            flake.opacity = (Math.random() * 0.5) + 0.3;
        }

        function init() {
            for (var i = 0; i < flakeCount; i++) {
                var x = Math.floor(Math.random() * canvas.width),
                    y = Math.floor(Math.random() * canvas.height),
                    size = (Math.random() * 3) + 2,
                    speed = (Math.random() * 1) + 0.5,
                    opacity = (Math.random() * 0.5) + 0.3;

                flakes.push({
                    speed: speed,
                    velY: speed,
                    velX: 0,
                    x: x,
                    y: y,
                    size: size,
                    stepSize: (Math.random()) / 30,
                    step: 0,
                    opacity: opacity
                });
            }

            snow();
        };

        canvas.addEventListener("mousemove", function(e) {
            mX = e.clientX,
                mY = e.clientY
        });

        window.addEventListener("resize",function(){
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        })

        init()

    }

    popRoute = () => {
        const newStack = this.state.navigationStack.filter((_,i) => i !== this.state.navigationStack.length -1),
            logoStyle = newStack[newStack.length-1].id === 'MENU' ? {
                width: '200px',
            } : {
                width: '100px',
            }

        this.setState({
            navigationStack: newStack,
            logoStyle
        })
    }

    onUserChanged = (name,email) => {
        this.setState({user: {
            name: name,
            email: email,
            isValid: this.isEmailValid(email) && name.length
        }})
    }

    isEmailValid = email => {
        let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return re.test(email)
    }

    onClickButton = (action) => {
        if (action === 'BACK') this.popRoute()
        else {
            this.setState({
                logoStyle: {
                    width: action.includes('SEND') ? '200px' : '100px',
                },
                navigationStack: [
                    ...this.state.navigationStack,
                    {
                        id: action
                    }
                ]
            })
            if (action === 'SEND_CREATE') this.createGroup()
            if (action === 'SEND_JOIN') this.joinGroup()
        }
    }

    createGroup = () => {
        if (this.state.create) {
            const params = {
                groupName: this.state.create,
                name: this.state.user.name,
                email: this.state.user.email,
            }
            console.log(params)
            Api.post('/pending-group', params)
                .then(result => console.log(result))
        }
    }

    searchGroups = text => {
        if (text === '') this.setState({join: {search: '', results: []}})
        else {
            this.setState({join: {...this.state.join, search: text}})
            const params = {
                email: this.state.user.email,
                text: text
            }
            console.log(params)
            Api.get('/group', params)
                .then(groups => this.setState({join: {...this.state.join, results: groups}}))
        }
    }

    setGroupToJoin = id => this.setState({
        join: {
            ...this.state.join,
            id_selected: id
        }
    })

    joinGroup = () => {
        if (this.state.join.id_selected) {
            const params = {
                id: this.state.join.id_selected,
                name: this.state.user.name,
                email: this.state.user.email,
            }
            console.log(params)
            Api.post('/join', params)
                .then(result => console.log(result))
        }
    }

    render() {
        console.log(this.state)
        const currentView = this.state.navigationStack[this.state.navigationStack.length-1]
        return (
            <div className="App">
                <canvas ref="canvas" id="canvas" />
                <div className="blob">
                    {this.state.navigationStack.length > 1 && !currentView.id.includes('SEND') ? (
                        <button onClick={this.onClickButton.bind(this,'BACK')} className="backButton">&larr;</button>
                    ) : null}
                    <img style={this.state.logoStyle} src={logo} alt="santa" className="logo" />
                    {currentView.id === 'MENU' ? (
                        <div>
                            <h1>Secret 9Santa</h1>
                            <input
                                type="text"
                                className="textInput"
                                placeholder="Your name"
                                value={this.state.user.name}
                                onChange={evt => this.onUserChanged(evt.target.value,this.state.user.email)}
                            />
                            <input
                                type="text"
                                className="textInput"
                                placeholder="Your email"
                                value={this.state.user.email}
                                onChange={evt => this.onUserChanged(this.state.user.name,evt.target.value)}
                            />
                            {this.state.user.isValid ? (
                                <div className="containerButtons">
                                    <button onClick={this.onClickButton.bind(this,'CREATE')}>Create</button>
                                    <div />
                                    <button onClick={this.onClickButton.bind(this,'JOIN')}>Join</button>
                                </div>
                            ) : <div />}
                        </div>
                    ) : currentView.id === 'CREATE' ? (
                        <div>
                            <h1>Create a group</h1>
                            <input
                                type="text"
                                className="textInput"
                                placeholder="Group name"
                                value={this.state.create}
                                onChange={evt => this.setState({create: evt.target.value})}
                            />
                            {this.state.create.length > 1 ? <button onClick={this.onClickButton.bind(this,'SEND_CREATE','200px')}>Create</button> : null}
                        </div>
                    ) : currentView.id === 'JOIN' ? (
                        <div>
                            <h1>Join a group</h1>
                            <input
                                type="text"
                                className="textInput"
                                placeholder="Group name"
                                value={this.state.join.search}
                                onChange={evt => this.searchGroups(evt.target.value)}
                            />
                            {this.state.join.results.length ? (
                                <div className="searchContainer">
                                    {this.state.join.results.map((group,i) => (
                                        <div onClick={this.setGroupToJoin.bind(this,group.id)}
                                             className={this.state.join.id_selected === group.id ? 'groupToJoin active' : 'groupToJoin'}
                                             key={i} >
                                            {group.name}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {this.state.join.id_selected ? <button onClick={this.onClickButton.bind(this,'SEND_JOIN','200px')}>Join</button> : null}
                        </div>
                    ) : currentView.id.includes('SEND') ? <h2>3Check your emails 3</h2>
                    : <div />}
                </div>
            </div>

        )
    }
}

export default App;

(this["webpackJsonpsecret-santa"]=this["webpackJsonpsecret-santa"]||[]).push([[0],{14:function(t,e,n){},15:function(t,e,n){},17:function(t,e,n){"use strict";n.r(e);var i=n(2),a=n(6),o=n.n(a),s=(n(14),n(1)),r=n(7),c=n(3),l=n(4),u=n(9),h=n(8),d=(n(15),function(){function t(){Object(c.a)(this,t)}return Object(l.a)(t,null,[{key:"headers",value:function(){return{Accept:"application/json","Content-Type":"application/json"}}},{key:"get",value:function(t){return this.xhr(t,null,"GET")}},{key:"put",value:function(t,e){return this.xhr(t,e,"PUT")}},{key:"post",value:function(t,e){return this.xhr(t,e,"POST")}},{key:"delete",value:function(t,e){return this.xhr(t,e,"DELETE")}},{key:"xhr",value:function(e,n,i){var a="https://".concat("fedutia.fr/secret-santa").concat(e),o=Object.assign({method:i},n?{body:JSON.stringify(n)}:null);return o.headers=t.headers(),fetch(a,o).then((function(t){var e=t.json();return t.ok?e:e.then((function(t){throw t}))})).then((function(t){return t.results}))}}]),t}()),j=n.p+"static/media/santa.91c6d0ee.png",p=n(0),v=function(t){Object(u.a)(n,t);var e=Object(h.a)(n);function n(t){var i;return Object(c.a)(this,n),(i=e.call(this,t)).componentDidMount=function(){var t=[],e=i.refs.canvas,n=e.getContext("2d"),a=-100,o=-100;e.width=window.innerWidth,e.height=window.innerHeight;var s=window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame||window.msRequestAnimationFrame||function(t){window.setTimeout(t,1e3/60)};function r(){n.clearRect(0,0,e.width,e.height);for(var i=0;i<400;i++){var l=t[i],u=a,h=o,d=l.x,j=l.y,p=Math.sqrt((d-u)*(d-u)+(j-h)*(j-h));if(p<150){var v=(u-d)/p,f=(h-j)/p,g=150/(p*p)/2;l.velX-=g*v,l.velY-=g*f}else l.velX*=.98,l.velY<=l.speed&&(l.velY=l.speed),l.velX+=Math.cos(l.step+=.05)*l.stepSize;n.fillStyle="rgba(255,255,255,"+l.opacity+")",l.y+=l.velY,l.x+=l.velX,(l.y>=e.height||l.y<=0)&&c(l),(l.x>=e.width||l.x<=0)&&c(l),n.beginPath(),n.arc(l.x,l.y,l.size,0,2*Math.PI),n.fill()}s(r)}function c(t){t.x=Math.floor(Math.random()*e.width),t.y=0,t.size=3*Math.random()+2,t.speed=1*Math.random()+.5,t.velY=t.speed,t.velX=0,t.opacity=.5*Math.random()+.3}window.requestAnimationFrame=s,e.addEventListener("mousemove",(function(t){a=t.clientX,o=t.clientY})),window.addEventListener("resize",(function(){e.width=window.innerWidth,e.height=window.innerHeight})),function(){for(var n=0;n<400;n++){var i=Math.floor(Math.random()*e.width),a=Math.floor(Math.random()*e.height),o=3*Math.random()+2,s=1*Math.random()+.5,c=.5*Math.random()+.3;t.push({speed:s,velY:s,velX:0,x:i,y:a,size:o,stepSize:Math.random()/30,step:0,opacity:c})}r()}()},i.popRoute=function(){var t=i.state.navigationStack.filter((function(t,e){return e!==i.state.navigationStack.length-1})),e="MENU"===t[t.length-1]._id?{width:"200px"}:{width:"100px"};i.setState({navigationStack:t,logoStyle:e})},i.onUserChanged=function(t,e){i.setState({user:{name:t,email:e,isValid:i.isEmailValid(e)&&t.length}})},i.isEmailValid=function(t){return/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(t)},i.onClickButton=function(t){"BACK"===t?i.popRoute():(i.setState({logoStyle:{width:t.includes("SEND")?"200px":"100px"},navigationStack:[].concat(Object(r.a)(i.state.navigationStack),[{_id:t}])}),"SEND_CREATE"===t&&i.createGroup(),"SEND_JOIN"===t&&i.joinGroup())},i.createGroup=function(){if(i.state.create){var t={groupName:i.state.create,name:i.state.user.name,email:i.state.user.email};console.log(t),d.put("/pending-group",t).then((function(t){return console.log(t)}))}},i.searchGroups=function(t){if(""===t)i.setState({join:{search:"",results:[]}});else{i.setState({join:Object(s.a)(Object(s.a)({},i.state.join),{},{search:t})});var e={email:i.state.user.email,text:t};console.log(e),d.post("/group",e).then((function(t){return i.setState({join:Object(s.a)(Object(s.a)({},i.state.join),{},{results:t})})}))}},i.setGroupToJoin=function(t){return i.setState({join:Object(s.a)(Object(s.a)({},i.state.join),{},{id_selected:t})})},i.joinGroup=function(){if(i.state.join.id_selected){var t={_id:i.state.join.id_selected,name:i.state.user.name,email:i.state.user.email};console.log(t),d.post("/join",t).then((function(t){return console.log(t)}))}},i.state={user:{name:"",email:"",isValid:!1},logoStyle:{width:"200px"},blobStyle:{width:window.width,height:window.height},navigationStack:[{_id:"MENU"}],create:"",join:{search:"",results:[],id_selected:null}},i}return Object(l.a)(n,[{key:"render",value:function(){var t=this;console.log(this.state);var e=this.state.navigationStack[this.state.navigationStack.length-1];return Object(p.jsxs)("div",{className:"App",children:[Object(p.jsx)("canvas",{ref:"canvas",id:"canvas"}),Object(p.jsxs)("div",{className:"blob",children:[this.state.navigationStack.length>1&&!e._id.includes("SEND")?Object(p.jsx)("button",{onClick:this.onClickButton.bind(this,"BACK"),className:"backButton",children:"\u2190"}):null,Object(p.jsx)("img",{style:this.state.logoStyle,src:j,alt:"santa",className:"logo"}),"MENU"===e._id?Object(p.jsxs)("div",{children:[Object(p.jsx)("h1",{children:"Secret 9Santa"}),Object(p.jsx)("input",{type:"text",className:"textInput",placeholder:"Your name",value:this.state.user.name,onChange:function(e){return t.onUserChanged(e.target.value,t.state.user.email)}}),Object(p.jsx)("input",{type:"text",className:"textInput",placeholder:"Your email",value:this.state.user.email,onChange:function(e){return t.onUserChanged(t.state.user.name,e.target.value)}}),this.state.user.isValid?Object(p.jsxs)("div",{className:"containerButtons",children:[Object(p.jsx)("button",{onClick:this.onClickButton.bind(this,"CREATE"),children:"Create"}),Object(p.jsx)("div",{}),Object(p.jsx)("button",{onClick:this.onClickButton.bind(this,"JOIN"),children:"Join"})]}):Object(p.jsx)("div",{})]}):"CREATE"===e._id?Object(p.jsxs)("div",{children:[Object(p.jsx)("h1",{children:"Create a group"}),Object(p.jsx)("input",{type:"text",className:"textInput",placeholder:"Group name",value:this.state.create,onChange:function(e){return t.setState({create:e.target.value})}}),this.state.create.length>1?Object(p.jsx)("button",{onClick:this.onClickButton.bind(this,"SEND_CREATE","200px"),children:"Create"}):null]}):"JOIN"===e._id?Object(p.jsxs)("div",{children:[Object(p.jsx)("h1",{children:"Join a group"}),Object(p.jsx)("input",{type:"text",className:"textInput",placeholder:"Group name",value:this.state.join.search,onChange:function(e){return t.searchGroups(e.target.value)}}),this.state.join.results.length?Object(p.jsx)("div",{className:"searchContainer",children:this.state.join.results.map((function(e,n){return Object(p.jsx)("div",{onClick:t.setGroupToJoin.bind(t,e._id),className:t.state.join.id_selected===e._id?"groupToJoin active":"groupToJoin",children:e.name},n)}))}):null,this.state.join.id_selected?Object(p.jsx)("button",{onClick:this.onClickButton.bind(this,"SEND_JOIN","200px"),children:"Join"}):null]}):e._id.includes("SEND")?Object(p.jsx)("h2",{children:"3Check your emails 3"}):Object(p.jsx)("div",{})]})]})}}]),n}(i.Component),f=Boolean("localhost"===window.location.hostname||"[::1]"===window.location.hostname||window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/));function g(t){navigator.serviceWorker.register(t).then((function(t){t.onupdatefound=function(){var e=t.installing;e.onstatechange=function(){"installed"===e.state&&(navigator.serviceWorker.controller?console.log("New content is available; please refresh."):console.log("Content is cached for offline use."))}}})).catch((function(t){console.error("Error during service worker registration:",t)}))}o.a.render(Object(p.jsx)(v,{}),document.getElementById("root")),function(){if("serviceWorker"in navigator){if(new URL("",window.location).origin!==window.location.origin)return;window.addEventListener("load",(function(){var t="".concat("","/service-worker.js");f?function(t){fetch(t).then((function(e){404===e.status||-1===e.headers.get("content-type").indexOf("javascript")?navigator.serviceWorker.ready.then((function(t){t.unregister().then((function(){window.location.reload()}))})):g(t)})).catch((function(){console.log("No internet connection found. App is running in offline mode.")}))}(t):g(t)}))}}()}},[[17,1,2]]]);
//# sourceMappingURL=main.ff31f0f8.chunk.js.map
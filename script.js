const $=id=>document.getElementById(id),c=customer;
const path=location.pathname.split("/").pop()||"index.html";
function txt(id,v){const e=$(id);if(e)e.textContent=v||""}
if(path==="index.html"){txt("eyebrow",c.heroEyebrow);txt("title",c.heroTitle);txt("subtitle",c.heroSubtitle);txt("note",c.heroNote)}
if(path==="wishes.html"){txt("title",c.wishTitle);txt("intro",c.wishIntro);txt("one",c.wishOne);txt("two",c.wishTwo)}
if(path==="journey.html"){txt("title",c.journeyTitle);txt("sub",c.journeySub);$("timeline").innerHTML=c.timeline.map(x=>`<article><span></span><div><small>${x[0]}</small><h3>${x[1]}</h3><p>${x[2]}</p></div></article>`).join("")}
if(path==="memories.html"){txt("title",c.memoryTitle);txt("sub",c.memorySub);$("wall").innerHTML=c.photos.map((p,i)=>`<figure style="--r:${i%2?"1.5deg":"-1.2deg"}"><img src="${p[0]}" alt="Memory ${i+1}"><figcaption>${p[1]}</figcaption></figure>`).join("")}
if(path==="surprise.html"){txt("title",c.surpriseTitle);txt("sub",c.surpriseSub);txt("text",c.surpriseText);$("flower").onclick=()=>{$("flower").style.transform="scale(.5)";setTimeout(()=>{$("flower").style.display="none";$("card").classList.add("open");$("next").style.display="inline-block"},350)}}
if(path==="favorite.html"){txt("title",c.favoriteTitle);txt("sub",c.favoriteSub);$("img").src=c.favoriteImage;txt("caption",c.favoriteCaption)}
if(path==="goodbye.html"){txt("title",c.goodbyeTitle);txt("text",c.goodbyeText);txt("signature",c.signature)}

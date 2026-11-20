# closer to the real SSB drawing: landscape-ish crop, title block of separate lines along the bottom,
# legend box standing on it at the right with rotated icons, jetty root buildings just above the title block
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import math
W,H=420*mm,297*mm
c=canvas.Canvas("jetty2.pdf",pagesize=(W,H)); c.setLineWidth(0.3)
L=lambda x0,y0,x1,y1: c.line(x0*mm,y0*mm,x1*mm,y1*mm)
for a in [(10,10,410,10),(410,10,410,287),(410,287,10,287),(10,287,10,10)]: L(*a)  # frame as 4 lines
# title block: separate lines
L(60,10,60,40); L(300,40,60,40)
for x in [110,150,190,230,250,270,300,330,360,385]: L(x,10,x,40)
L(300,10,300,40); L(410,40,300,40)
for y in [18,26,33]: L(60,y,410,y)
c.setFont("Helvetica",4)
for i,t in enumerate(["PLAN D'ETAT DES LIEUX","SSB","Echelle 1:500","HERBOSH-KIER","Rev","Date","Dessine","Verifie"]): c.drawString((62+i*30)*mm,(20+ (i%2)*8)*mm,t)
# legend standing on the title block
L(330,40,330,110); L(330,110,410,110)
c.setFont("Helvetica",5); c.drawString(335*mm,102*mm,"LEGENDE:")
for i,t in enumerate(["Conteneurs","Guerite","WC","Fosse","Ligne / Poteau M.T.","Reseau E. Usees"]):
    y=(95-i*8)*mm; x=338*mm
    c.saveState(); c.translate(x,y); c.rotate(-15+5*i); c.rect(-3*mm,-1*mm,6*mm,2*mm); c.restoreState()
    c.drawString(345*mm,y-1*mm,"- "+t)
# jetty
k=2*mm; org=(140*mm,48*mm); a=math.radians(68)
def P(u,v): x=u*math.cos(a)-v*math.sin(a); y=u*math.sin(a)+v*math.cos(a); return org[0]+x*k,org[1]+y*k
Lg,Wd=125,32
pts=[P(0,0),P(Lg,0),P(Lg,Wd),P(0,Wd)]
for i in range(4): q=pts[(i+1)%4]; c.line(*pts[i],*q)
c.setFont("Helvetica",3)
for i in range(10):
    u=8+i*12
    for v in (0.8,Wd-0.8):
        x,y=P(u,v); c.circle(x,y,0.45*k); c.drawString(x+1*mm,y,"B%02d"%(2*i+(v>1)))
    x,y=P(u+5,Wd/2); c.circle(x,y,0.25*mm,fill=1); c.drawString(x+0.8*mm,y,"+3.1")
for (u,v,w,h,lab) in [(3,4,12,7,"MAGASIN"),(3,14,6,3,"GUERITE"),(18,20,8,5,"")]:
    bp=[P(u,v),P(u+w,v),P(u+w,v+h),P(u,v+h)]; p=c.beginPath(); p.moveTo(*bp[0]); [p.lineTo(*q) for q in bp[1:]]; p.close(); c.drawPath(p)
    if lab: x,y=P(u+1,v+h/2); c.drawString(x,y,lab)
# north arrow top-left + a notes block
L(30,250,30,275); c.drawString(32*mm,268*mm,"N")
c.setFont("Helvetica",4)
for i in range(4): c.drawString(20*mm,(60+i*5)*mm,"Note %d: cotes en metres"%(i+1))
c.save()

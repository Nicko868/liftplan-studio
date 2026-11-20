from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import math
W,H=297*mm,420*mm
c=canvas.Canvas("jetty.pdf",pagesize=(W,H)); c.setLineWidth(0.3)
c.rect(10*mm,10*mm,277*mm,400*mm)  # frame
# title block table
x0,y0,x1,y1=10*mm,10*mm,287*mm,32*mm
c.rect(x0,y0,x1-x0,y1-y0)
for xx in [60,95,130,170,200,230,260]: c.line(xx*mm,y0,xx*mm,y1)
for yy in [17,24]: c.line(x0,yy*mm,x1,yy*mm)
c.setFont("Helvetica",5); c.drawString(12*mm,26*mm,"PLAN D'ETAT DES LIEUX"); c.drawString(12*mm,19*mm,"Echelle 1:500"); c.drawString(97*mm,26*mm,"HERBOSH-KIER")
for i,t in enumerate(["Dessine","Verifie","Date","Rev","Indice"]): c.drawString((172+i*18)*mm,12*mm,t)
# key box on right above title block
c.rect(230*mm,32*mm,57*mm,45*mm)
for i in range(4): c.rect(255*mm,(40+i*8)*mm,4*mm,3*mm)
c.rect(245*mm,70*mm,10*mm,2*mm)
# legend top-left
c.rect(20*mm,380*mm,60*mm,25*mm); c.setFont("Helvetica",6)
for i,t in enumerate(["HERBOSH-KIER","PLAN D'ETAT DES LIEUX","PORT DE DAKAR - Plan de Recolement","Au 06 Mai 2026"]): c.drawString(22*mm,(400-i*5)*mm,t)
# north arrow
c.line(30*mm,355*mm,30*mm,375*mm); p=c.beginPath(); p.moveTo(28.5*mm,370*mm); p.lineTo(30*mm,376*mm); p.lineTo(31.5*mm,370*mm); p.close(); c.drawPath(p,fill=1); c.drawString(32*mm,362*mm,"N")
# jetty in metres -> paper mm = m*2 (1:500)
k=2*mm; org=(110*mm,70*mm); a=math.radians(70)
def P(u,v):  # u along jetty, v across (m)
    x=u*math.cos(a)-v*math.sin(a); y=u*math.sin(a)+v*math.cos(a); return org[0]+x*k,org[1]+y*k
L,Wd=180,30
pts=[P(0,0),P(L,0),P(L+4,6),P(L,Wd),P(0,Wd)]
for i in range(len(pts)): q=pts[(i+1)%len(pts)]; c.line(*pts[i],*q)   # separate segments
c.setDash(2,1); c.line(*P(5,Wd/2),*P(L-5,Wd/2)); c.setDash()  # crane track centreline
c.setFont("Helvetica",3)
for i in range(12):
    u=10+i*14
    for v in (0.8,Wd-0.8):
        x,y=P(u,v); c.circle(x,y,0.45*k,fill=0); c.drawString(x+1*mm,y,"B%02d"%(i*2+(v>1)))
    x,y=P(u+7,Wd/2+6); c.circle(x,y,0.3*mm,fill=1); c.drawString(x+0.8*mm,y,"+3.%02d"%i)
# buildings near the root
for (u,v,w,h) in [(8,6,10,6),(30,8,12,8)]:
    bp=[P(u,v),P(u+w,v),P(u+w,v+h),P(u,v+h)]; p=c.beginPath(); p.moveTo(*bp[0]); [p.lineTo(*q) for q in bp[1:]]; p.close(); c.drawPath(p)
    x,y=P(u+2,v+h/2); c.drawString(x,y,"MAGASIN")
c.save()

import {createClient} from 'npm:@supabase/supabase-js@2';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json({error:'Unauthorized'},401);
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'))[0];
 const db=createClient(Deno.env.get('SUPABASE_URL'),key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return json({error:'Unauthorized'},401);
 const {data:admin}=await db.from('profiles').select('role,active').eq('id',user.id).maybeSingle();
 if(!admin?.active||admin.role!=='ADMIN')return json({error:'Chỉ ADMIN được quản lý tài khoản'},403);
 let input;try{input=await req.json();}catch{return json({error:'Dữ liệu không hợp lệ'},400);}
 if(!['create','reset'].includes(input.action))return json({error:'Thao tác không hợp lệ'},400);
 const {count,error:limitError}=await db.from('admin_events').select('id',{count:'exact',head:true}).eq('actor',user.id).in('kind',['ACCOUNT_CREATE','ACCOUNT_RESET']).gte('created_at',new Date(Date.now()-3600000).toISOString());
 if(limitError)return json({error:'Không kiểm tra được nhật ký quản trị'},503);
 if(count>=30)return json({error:'Tối đa 30 thao tác tài khoản mỗi giờ'},429);
 const password=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
 if(input.action==='reset'){
  if(typeof input.id!=='string'||input.id===user.id)return json({error:'Không thể đặt lại tài khoản này'},400);
  const {data:person}=await db.from('profiles').select('id,role,email').eq('id',input.id).maybeSingle();
  if(!person||person.role==='ADMIN')return json({error:'Không thể đặt lại tài khoản quản trị'},403);
  const {error}=await db.auth.admin.updateUserById(person.id,{password});if(error)return json({error:'Không đổi được mật khẩu'},502);
  await db.from('admin_events').insert({actor:user.id,kind:'ACCOUNT_RESET',target:person.id});
  return json({ok:true,email:person.email,password});
 }
 const email=String(input.email||'').trim().toLowerCase(),name=String(input.name||'').trim(),role=input.role;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>200||!['TELESALES','EXECUTIVE'].includes(role))return json({error:'Kiểm tra email, họ tên và vai trò'},400);
 const {data:exists}=await db.from('profiles').select('id').eq('email',email).maybeSingle();if(exists)return json({error:'Email đã có tài khoản CRM'},409);
 const {data:created,error:createError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}});
 if(createError)return json({error:'Không tạo được tài khoản; email có thể đã tồn tại'},409);
 const {error:profileError}=await db.from('profiles').insert({id:created.user.id,email,name,role,active:true});
 if(profileError)return json({error:'Tài khoản đăng nhập đã tạo nhưng chưa cấp quyền. Liên hệ quản trị hệ thống để hoàn tất; không tạo lại.'},502);
 await db.from('admin_events').insert({actor:user.id,kind:'ACCOUNT_CREATE',target:created.user.id,detail:{role}});
 return json({ok:true,email,password});
});

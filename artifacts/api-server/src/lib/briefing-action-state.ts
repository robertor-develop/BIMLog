export function isOverdueBriefingAction(action:{status:string;dueDate:Date|string|null},now=new Date()):boolean{
  return !["complete","completed","cancelled"].includes(action.status)&&action.dueDate!==null&&new Date(action.dueDate).getTime()<now.getTime();
}

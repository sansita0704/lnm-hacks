import Agent from "@/components/Agent";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { db } from "@/firebase/admin";

const Page = async () => {
    const user = await getCurrentUser();

    const newInterviewRef = db.collection("interviews").doc();
    const interviewId = newInterviewRef.id;

    return (
        <>
            <h3>Interview generation</h3>

            <Agent
                userName={user?.name!}
                userId={user?.id}
                interviewId={interviewId}
                // profileImage={user?.profileURL}
                type="generate"
            />
        </>
    );
};

export default Page;

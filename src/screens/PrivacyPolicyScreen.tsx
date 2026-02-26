import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeContext } from '../context/ThemeContext';
import { FONT_SIZE, FONT_WEIGHT, SPACING, RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PrivacyPolicyScreen = () => {
    const { colors } = useThemeContext();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, SPACING.l) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.text, { color: colors.text }]}>
                    <Text style={styles.heading}>Privacy Policy</Text>
                    {"\n\n"}
                    This privacy policy applies to the McAi player app (hereby referred to as "Application") for mobile devices that was created by Mustak ahamed (hereby referred to as "Service Provider") as an Ad Supported service. This service is intended for use "AS IS".
                    {"\n\n"}
                    <Text style={styles.heading}>Information Collection and Use</Text>
                    {"\n\n"}
                    The Application collects information when you download and use it. This information may include information such as:
                    {"\n\n"}
                    • Your device's Internet Protocol address (e.g. IP address)
                    {"\n"}
                    • The pages of the Application that you visit, the time and date of your visit, the time spent on those pages
                    {"\n"}
                    • The time spent on the Application
                    {"\n"}
                    • The operating system you use on your mobile device
                    {"\n\n"}
                    The Application does not gather precise information about the location of your mobile device.
                    {"\n\n"}
                    <Text style={styles.heading}>Artificial Intelligence (AI)</Text>
                    {"\n\n"}
                    The Application uses Artificial Intelligence (AI) technologies to enhance user experience and provide certain features. The AI components may process user data to deliver personalized content, recommendations, or automated functionalities. All AI processing is performed in accordance with this privacy policy and applicable laws. If you have questions about the AI features or data processing, please contact the Service Provider.
                    {"\n\n"}
                    The Service Provider may use the information you provided to contact you from time to time to provide you with important information, required notices and marketing promotions.
                    {"\n\n"}
                    For a better experience, while using the Application, the Service Provider may require you to provide us with certain personally identifiable information, including but not limited to none. The information that the Service Provider request will be retained by them and used as described in this privacy policy.
                    {"\n\n"}
                    <Text style={styles.heading}>Third Party Access</Text>
                    {"\n\n"}
                    Only aggregated, anonymized data is periodically transmitted to external services to aid the Service Provider in improving the Application and their service. The Service Provider may share your information with third parties in the ways that are described in this privacy statement.
                    {"\n\n"}
                    Please note that the Application utilizes third-party services that have their own Privacy Policy about handling data. Below are the links to the Privacy Policy of the third-party service providers used by the Application:
                    {"\n\n"}
                    • AdMob
                    {"\n"}
                    • Expo
                    {"\n\n"}
                    The Service Provider may disclose User Provided and Automatically Collected Information:
                    {"\n\n"}
                    • as required by law, such as to comply with a subpoena, or similar legal process;
                    {"\n"}
                    • when they believe in good faith that disclosure is necessary to protect their rights, protect your safety or the safety of others, investigate fraud, or respond to a government request;
                    {"\n"}
                    • with their trusted services providers who work on their behalf, do not have an independent use of the information we disclose to them, and have agreed to adhere to the rules set forth in this privacy statement.
                    {"\n\n"}
                    <Text style={styles.heading}>Opt-Out Rights</Text>
                    {"\n\n"}
                    You can stop all collection of information by the Application easily by uninstalling it. You may use the standard uninstall processes as may be available as part of your mobile device or via the mobile application marketplace or network.
                    {"\n\n"}
                    <Text style={styles.heading}>Data Retention Policy</Text>
                    {"\n\n"}
                    The Service Provider will retain User Provided data for as long as you use the Application and for a reasonable time thereafter. If you'd like them to delete User Provided Data that you have provided via the Application, please contact them at flixindia99@gmail.com and they will respond in a reasonable time.
                    {"\n\n"}
                    <Text style={styles.heading}>Children</Text>
                    {"\n\n"}
                    The Service Provider does not use the Application to knowingly solicit data from or market to children under the age of 13.
                    {"\n\n"}
                    The Application does not address anyone under the age of 13. The Service Provider does not knowingly collect personally identifiable information from children under 13 years of age. In the case the Service Provider discover that a child under 13 has provided personal information, the Service Provider will immediately delete this from their servers. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact the Service Provider (flixindia99@gmail.com) so that they will be able to take the necessary actions.
                    {"\n\n"}
                    <Text style={styles.heading}>Security</Text>
                    {"\n\n"}
                    The Service Provider is concerned about safeguarding the confidentiality of your information. The Service Provider provides physical, electronic, and procedural safeguards to protect information the Service Provider processes and maintains.
                    {"\n\n"}
                    <Text style={styles.heading}>Changes</Text>
                    {"\n\n"}
                    This Privacy Policy may be updated from time to time for any reason. The Service Provider will notify you of any changes to the Privacy Policy by updating this page with the new Privacy Policy. You are advised to consult this Privacy Policy regularly for any changes, as continued use is deemed approval of all changes.
                    {"\n\n"}
                    This privacy policy is effective as of 2026-02-26
                    {"\n\n"}
                    <Text style={styles.heading}>Your Consent</Text>
                    {"\n\n"}
                    By using the Application, you are consenting to the processing of your information as set forth in this Privacy Policy now and as amended by us.
                    {"\n\n"}
                    <Text style={styles.heading}>Contact Us</Text>
                    {"\n\n"}
                    If you have any questions regarding privacy while using the Application, or have questions about the practices, please contact the Service Provider via email at flixindia99@gmail.com.
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    backButton: {
        padding: SPACING.s,
    },
    headerTitle: {
        fontSize: FONT_SIZE.l,
        fontWeight: FONT_WEIGHT.bold,
        marginLeft: SPACING.m,
    },
    scrollContent: {
        padding: SPACING.l,
        paddingTop: SPACING.xl,
    },
    text: {
        fontSize: FONT_SIZE.m,
        lineHeight: 24,
    },
    heading: {
        fontWeight: FONT_WEIGHT.bold,
        fontSize: FONT_SIZE.l,
    },
});

export default PrivacyPolicyScreen;

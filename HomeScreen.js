import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, FlatList, Image, TextInput, Modal } from 'react-native';
import { getDatabase, ref as dbRef, query, orderByChild, limitToLast, get, set } from 'firebase/database';
import { getStorage, ref, getDownloadURL, listAll } from 'firebase/storage';
import { auth } from './firebase'; // Import your Firebase setup
import { signOut } from 'firebase/auth';
import { storage } from './firebase';

// ADD THESE IMPORTS FOR NOTIFICATIONS
import * as Notifications from 'expo-notifications';

const HomeScreen = ({ navigation }) => {
    const [sensorData, setSensorData] = useState([]); // Stores the sensor data
    const [imageData, setImageData] = useState(null); // Stores the image URL and extracted description
    const [loading, setLoading] = useState(false); // Tracks loading state
    const [showSignOut, setShowSignOut] = useState(false); // Show sign-out button
    const [modalVisible, setModalVisible] = useState(false); // Modal visibility
    const [inputs, setInputs] = useState({ humidity: '', lightIntensity: '', temperature: '' }); // Input values
    const [historyData, setHistoryData] = useState([]); // Stores the history data
    const [historyModalVisible, setHistoryModalVisible] = useState(false); // Modal visibility for history

    // SET NOTIFICATION HANDLER
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });

    // REQUEST PERMISSIONS FOR NOTIFICATIONS
    const requestNotificationsPermission = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Allow notifications to get alerts about your plant.');
        }
    };

    // SEND NOTIFICATION FUNCTION
    const sendNotification = async (title, body) => {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: title,
                body: body,
                sound: true,
            },
            trigger: null,
        });
    };

    // Function to fetch sensor data from Firebase Realtime Database
    const fetchSensorData = async () => {
        try {
            setLoading(true);

            const database = getDatabase(undefined, 'https://plantmonitor-52b21-default-rtdb.europe-west1.firebasedatabase.app');
            const dataRef = query(dbRef(database, 'data'), orderByChild('timestamp'), limitToLast(1));
            const snapshot = await get(dataRef);

            if (snapshot.exists()) {
                const latestData = Object.values(snapshot.val())[0];
                console.log('Fetched Sensor Data:', latestData);

                const humidityVal = latestData.humidity || 0;
                const temperatureVal = latestData.temperature || 0;

                // CHECK THRESHOLDS AND SEND NOTIFICATIONS
                if (humidityVal > 40) {
                    sendNotification('Humidity Alert', 'Humidity Level Increased Significantly.');
                }
                if (temperatureVal > 10) {
                    sendNotification('Temperature Alert', 'High Temperature for your plant.');
                }

                setSensorData([
                    { key: 'Humidity', value: humidityVal },
                    { key: 'Temperature', value: temperatureVal },
                    { key: 'Light Intensity', value: latestData['light intensity'] || 'N/A' },
                ]);
            } else {
                Alert.alert('No data found', 'Unable to fetch the latest sensor data.');
            }
        } catch (error) {
            console.error('Error fetching sensor data:', error);
            Alert.alert('Error', 'Failed to fetch sensor data.');
        } finally {
            setLoading(false);
        }
    };

    // Function to fetch the latest image and description from Firebase Storage
    const fetchImage = async () => {
        try {
            setLoading(true);

            const database = getDatabase(undefined, 'https://plantmonitor-52b21-default-rtdb.europe-west1.firebasedatabase.app');
            const imageRef = dbRef(database, 'image');

            // Step 1: Send "1" to the 'image' field
            await set(imageRef, 1);
            console.log("Realtime Database 'image' field set to 1.");

            // Step 2: Wait for 5 seconds
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Step 3: Reset the 'image' field to 0
            await set(imageRef, 0);
            console.log("Realtime Database 'image' field reset to 0.");

            // Step 4: Fetch the latest image from Firebase Storage
            const folderPath = 'imageofPlant/';
            const folderRef = ref(storage, folderPath);

            // List all items in the folder
            const folderContents = await listAll(folderRef);

            if (folderContents.items.length === 0) {
                throw new Error('No images found in the folder.');
            }

            // Get the latest file
            const latestImageRef = folderContents.items[folderContents.items.length - 1];
            const url = await getDownloadURL(latestImageRef);

            console.log('Image URL:', url);
            console.log('File Name:', latestImageRef.name);

            // Extract meaningful information from the file name
            const regex = /captured_image_(.*?)\.jpg/;
            const match = latestImageRef.name.match(regex);
            const description = match ? match[1] : 'Unknown';

            // Step 5: Set the image data to display
            setImageData({ url, description });
        } catch (error) {
            console.error('Error fetching image:', error);
            Alert.alert('Error', error.message || 'Failed to fetch the image.');
        } finally {
            setLoading(false);
        }
    };

    // Function to start watering
    const startWatering = async () => {
        try {
            const database = getDatabase(undefined, 'https://plantmonitor-52b21-default-rtdb.europe-west1.firebasedatabase.app');
            const wateringRef = dbRef(database, 'watering');
            await set(wateringRef, 1); // Set watering to 1
            Alert.alert('Success', 'Watering started!');
        } catch (error) {
            console.error('Error starting watering:', error);
            Alert.alert('Error', 'Failed to start watering.');
        }
    };

    // Function to stop watering
    const stopWatering = async () => {
        try {
            const database = getDatabase(undefined, 'https://plantmonitor-52b21-default-rtdb.europe-west1.firebasedatabase.app');
            const wateringRef = dbRef(database, 'watering');
            await set(wateringRef, 0); // Set watering to 0
            Alert.alert('Success', 'Watering stopped!');
        } catch (error) {
            console.error('Error stopping watering:', error);
            Alert.alert('Error', 'Failed to stop watering.');
        }
    };

    // Handle modal input submission
    const handleSubmitInputs = async () => {
        try {
            const database = getDatabase(undefined, 'https://plantmonitor-52b21-default-rtdb.europe-west1.firebasedatabase.app');
            const defaultRef = dbRef(database, 'default');

            // Save user inputs to Firebase
            await set(defaultRef, {
                humidity: inputs.humidity,
                lightIntensity: inputs.lightIntensity,
                temperature: inputs.temperature,
            });

            Alert.alert('Success', 'Default values updated!');
            setModalVisible(false); // Close modal
        } catch (error) {
            console.error('Error updating default values:', error);
            Alert.alert('Error', 'Failed to update default values.');
        }
    };

    useEffect(() => {
        requestNotificationsPermission();
        fetchSensorData(); // Fetch data when the component mounts
    }, []);
    // Function to fetch the last 50 data entries
    const fetchHistoryData = async () => {
        try {
            setLoading(true);

            const database = getDatabase(undefined, 'https://plantmonitor-52b21-default-rtdb.europe-west1.firebasedatabase.app');
            const dataRef = query(dbRef(database, 'data'), orderByChild('timestamp'), limitToLast(50));
            const snapshot = await get(dataRef);

            if (snapshot.exists()) {
                const history = Object.values(snapshot.val()).reverse(); // Reverse to display latest first
                setHistoryData(history); // Set history data
                setHistoryModalVisible(true); // Open the history modal
            } else {
                Alert.alert('No data found', 'Unable to fetch history data.');
            }
        } catch (error) {
            console.error('Error fetching history data:', error);
            Alert.alert('Error', 'Failed to fetch history data.');
        } finally {
            setLoading(false);
        }
    };


    const renderSensorItem = ({ item }) => (
        <View style={styles.sensorContainer}>
            <Text style={styles.sensorText}>
                {item.key}: {item.value}
            </Text>
        </View>
    );
    const renderHistoryItem = ({ item, index }) => (
        <View style={styles.historyContainer}>
            <Text style={styles.historyText}>
                {index + 1}. Humidity: {item.humidity}, Temperature: {item.temperature}, Light Intensity: {item['light intensity']}
            </Text>
        </View>
    );
    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.title}>Sensor Data</Text>
                <TouchableOpacity
                    style={styles.smallButton}
                    onPress={fetchHistoryData} // Fetch and show history data
                >
                    <Text style={styles.smallButtonText}>History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => setModalVisible(true)} // Open modal
                >
                    <Text style={styles.smallButtonText}>Edit</Text>
                </TouchableOpacity>

            </View>

            <FlatList
                data={sensorData}
                renderItem={renderSensorItem}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.list}
            />

            {imageData && (
                <>
                    <Image source={{ uri: imageData.url }} style={styles.image} />
                    <Text style={styles.imageDescription}>Detected: {imageData.description}</Text>
                </>
            )}

            <TouchableOpacity style={styles.button} onPress={fetchSensorData} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Refreshing...' : 'Refresh Sensor Data'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={fetchImage} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Loading Image...' : 'Fetch Latest Image'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={startWatering}>
                <Text style={styles.buttonText}>Start Watering</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={stopWatering}>
                <Text style={styles.buttonText}>Stop Watering</Text>
            </TouchableOpacity>

            {/* Modal for editing defaults */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >


                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Default Values</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Humidity"
                            keyboardType="numeric"
                            value={inputs.humidity}
                            onChangeText={(text) => setInputs({ ...inputs, humidity: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Light Intensity"
                            keyboardType="numeric"
                            value={inputs.lightIntensity}
                            onChangeText={(text) => setInputs({ ...inputs, lightIntensity: text })}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Temperature"
                            keyboardType="numeric"
                            value={inputs.temperature}
                            onChangeText={(text) => setInputs({ ...inputs, temperature: text })}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalButton} onPress={handleSubmitInputs}>
                                <Text style={styles.modalButtonText}>Submit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal
                animationType="slide"
                transparent={true}
                visible={historyModalVisible}
                onRequestClose={() => setHistoryModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>History Data</Text>
                        <FlatList
                            data={historyData}
                            renderItem={({ item, index }) => (
                                <View style={styles.historyContainer}>
                                    <Text style={styles.historyText}>
                                        {index + 1}. Humidity: {item.humidity}, Temperature: {item.temperature}, Light Intensity: {item['light intensity']}
                                    </Text>
                                </View>
                            )}
                            keyExtractor={(item, index) => index.toString()}
                        />
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setHistoryModalVisible(false)}
                        >
                            <Text style={styles.modalButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#FFF4CB',
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    smallButton: {
        backgroundColor: '#3A3838',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 5,
    },
    smallButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    list: {
        marginBottom: 20,
    },
    sensorContainer: {
        padding: 15,
        backgroundColor: '#3A3838',
        borderRadius: 10,
        marginBottom: 10,
    },
    sensorText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    button: {
        backgroundColor: '#3A3838',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    image: {
        width: '100%',
        height: 200,
        alignSelf: 'center',
        marginTop: 20,
        borderRadius: 10,
    },
    imageDescription: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 10,
        color: '#3A3838',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '80%',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    input: {
        width: '100%',
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalButton: {
        backgroundColor: '#3A3838',
        padding: 10,
        borderRadius: 5,
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    modalButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    signOutButton: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        backgroundColor: '#3A3838',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    signOutButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default HomeScreen;
